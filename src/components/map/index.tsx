import { axisBottom } from 'd3-axis';
import { format } from 'd3-format';
import { ExtendedFeature, geoNaturalEarth1, geoPath, GeoSphere } from 'd3-geo';
import { scaleLog, scaleThreshold, ScaleThreshold } from 'd3-scale';
import { event, select } from 'd3-selection';
import { transition } from 'd3-transition';
import { zoom, zoomIdentity } from 'd3-zoom';
import * as React from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { feature, mesh } from 'topojson';
import {
  setRegionZoom,
  setSelectedRegion,
  toggleSelectedRegion,
} from '../../actions';
import {
  belowThresholdColor,
  getDataTypeColors,
  getFutureLocalRegionData,
  getPastLocalRegionData,
  GridData,
  gridQuintileColors,
  GridVariable,
  labelForGridVariable,
  LocalData,
  missingDataColor,
  WaterRegionGeoJSON,
  WaterRegionGeoJSONFeature,
} from '../../data';
import { StateTree } from '../../reducers';
import {
  getSelectedGridVariable,
  getSelectedWaterRegionId,
  getSelectedWorldRegion,
  getThresholdsForDataType,
  isZoomedInToRegion,
} from '../../selectors';
import { AnyDataType, AppType, TimeAggregate, WorldRegion } from '../../types';
import Spinner from '../generic/spinner';
import { Button, theme } from '../theme';
import ThresholdSelector from '../threshold-selector';

// tslint:disable:no-implicit-dependencies
const worldDataFilename = require('file-loader!../../../data/50m.jsonfix');
// For reduced file size and accuracy, uncomment the below:
// const worldDataFilename = require('file-loader!../../../data/110m.jsonfix');

const Container = styled.div`
  position: relative;
`;

const StyledThresholdSelector = styled(ThresholdSelector)`
  position: absolute;
`;

const ZoomButton = styled(Button)`
  position: absolute;
  right: 5px;
  bottom: 5px;

  padding: 5px 10px;
`;

const SpinnerOverlay = styled.div`
  display: flex;
  position: absolute;
  left: 0;
  top: 0;
  align-items: center;
  justify-content: center;
  text-align: center;
  background-color: rgba(255, 255, 255, 0.5);
`;

const Land = styled.path`
  fill: #d2e2e6;
`;

const MapTooltip = styled.div`
  position: absolute;
  background: #d2e2e6;
  border: 0px;
  padding: 4px;
  font-size: 12px;
  opacity: 0;
  & .river-tooltip {
    color: blue;
  }
`;

const CountryLabels = styled.g`
  pointer-events: none;
  text-anchor: middle;
  font-size: 12px;
`;

const PlaceLabels = styled.g`
  pointer-events: none;
  text-anchor: left;
  font-size: 10px;
`;

const SVG = styled.svg`
  /* Needed for IE11 */
  overflow: hidden;

  & .water-region {
    stroke-width: 0.5px;
    stroke: #ecf4f8;
    transition: opacity 0.2s ease-in;

    &.selected {
      stroke: ${theme.colors.cerise};
      stroke-width: 0.75px;
      transition: opacity 0.2s ease-out;
    }
    &.unselected {
      opacity: 0.5;
      transition: opacity 0.2s ease-out;
    }
    &.hide-fill {
      fill: none;
    }
  }

  & .clickable-water-region {
    fill: none;
    stroke: none;
    pointer-events: all;
  }
`;

const SelectedRegion = styled.g`
  & path {
    stroke: ${theme.colors.grayDark};
    stroke-width: 0.5px;
    opacity: 0.8;
    fill: none;
  }
`;

const CountryBorders = styled.g`
  stroke-width: 0.5px;
  stroke: ${theme.colors.grayDarkest};
  fill: none;
`;

const DDM = styled.g.attrs({ vectorEffect: 'non-scaling-stroke' })`
  stroke-width: 0.25px;
  stroke: #71bcd5;
  opacity: 0.8;
  fill: none;
  & .ddm-small {
    stroke-width: 0.1px;
  }
`;

const Rivers = styled.g`
  stroke-width: 0.5px;
  stroke: blue;
  fill: none;
`;

const scarcityColors = getDataTypeColors('scarcity');

const ScarcityLegend = styled.g`
  user-select: none;
`;

const LegendCaption = styled.text`
  fill: #000;
  font-size: 14px;
  text-anchor: start;
  font-weight: bold;
`;

const LegendLabel = styled.text`
  fill: #000;
  font-size: 12px;
  text-anchor: middle;
`;

function getColorScale(dataType: AnyDataType, thresholds: number[]) {
  const colors =
    // These data types have a larger = better scale
    dataType === 'shortage' || dataType === 'kcal'
      ? [belowThresholdColor, ...getDataTypeColors(dataType)].reverse()
      : [belowThresholdColor, ...getDataTypeColors(dataType)];

  return scaleThreshold<number, string>()
    .domain(thresholds)
    .range(colors);
}

interface PassedProps {
  width: number;
  selectedData?: TimeAggregate<number | undefined>;
  waterRegions: WaterRegionGeoJSON;
  selectedDataType: AnyDataType;
  appType: AppType;
  /**
   * Required for the the Past app.
   */
  selectedScenarioId?: string;
}

interface GeneratedStateProps {
  selectedWaterRegionId?: number;
  selectedWorldRegion?: WorldRegion;
  colorScale: ScaleThreshold<number, string>;
  thresholds: number[];
  stressThresholds: number[];
  shortageThresholds: number[];
  isZoomedIn: boolean;
  selectedGridVariable: GridVariable;
}

interface GeneratedDispatchProps {
  toggleSelectedRegion: (regionId: number) => void;
  clearSelectedRegion: () => void;
  setZoomedInToRegion: (zoomedIn: boolean) => void;
}

type Props = GeneratedStateProps & GeneratedDispatchProps & PassedProps;

interface State {
  regionData: {
    [scenarioId: string]: {
      [regionId: number]: LocalData | undefined;
    };
  };
  ongoingRequests: string[];
  zoomInRequested: boolean;
  countryGeoData?: GeoJSON.MultiLineString;
  landGeoData?: GeoJSON.FeatureCollection<
    GeoJSON.GeometryObject,
    GeoJSON.GeoJsonProperties
  >;
}

function getRequestId(scenarioId: string, regionId: number) {
  return `${scenarioId}-${regionId}`;
}

class Map extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      regionData: {},
      ongoingRequests: [],
      zoomInRequested: props.isZoomedIn,
    };
  }

  private svgRef!: SVGElement;
  private mapTooltipRef!: Element;

  public componentDidMount() {
    this.fetchWorldGeoData();
  }

  public componentDidUpdate(prevProps: Props, prevState: State) {
    const {
      selectedData,
      selectedWaterRegionId,
      selectedDataType,
      shortageThresholds,
      stressThresholds,
      thresholds,
      selectedWorldRegion,
      width,
    } = this.props;
    const { zoomInRequested, regionData, landGeoData } = this.state;
    const scenarioId = this.getScenarioId();

    if (!landGeoData || !selectedData) {
      return;
    }

    if (
      landGeoData &&
      selectedData &&
      (!prevState.landGeoData || !prevProps.selectedData)
    ) {
      // Initial data load
      this.drawMap();
      if (zoomInRequested) {
        this.zoomToWaterRegion();
      } else {
        this.zoomToGlobalArea(false);
      }
      return;
    }

    // FIXME: This is fugly
    const widthChanged = prevProps.width !== width;
    const didRequestZoomIn = !prevState.zoomInRequested && zoomInRequested;
    const didRequestZoomOut = prevState.zoomInRequested && !zoomInRequested;
    const waterRegionSelectedAndChanged =
      selectedWaterRegionId &&
      prevProps.selectedWaterRegionId !== selectedWaterRegionId;
    const waterRegionNoLongerSelected =
      !selectedWaterRegionId &&
      prevProps.selectedWaterRegionId !== selectedWaterRegionId;
    const selectedWorldRegionChanged =
      selectedWorldRegion !== prevProps.selectedWorldRegion;
    const zoomedInDataLoaded =
      selectedWaterRegionId &&
      regionData[scenarioId] &&
      regionData[scenarioId][selectedWaterRegionId] &&
      (!prevState.regionData[scenarioId] ||
        !prevState.regionData[scenarioId][selectedWaterRegionId]);
    const dataChanged =
      prevProps.selectedData !== selectedData ||
      prevProps.selectedDataType !== selectedDataType ||
      prevProps.thresholds !== thresholds ||
      (selectedDataType === 'scarcity' &&
        (prevProps.stressThresholds !== stressThresholds ||
          prevProps.shortageThresholds !== shortageThresholds));

    if (widthChanged) {
      // If width changes, redo everything
      this.clearMap();
      this.drawMap();

      if (!zoomInRequested) {
        this.zoomToGlobalArea();
      } else {
        this.removeZoomedInElements();
        this.zoomToWaterRegion();
      }

      return;
    }

    // Width has stayed the same
    if (waterRegionNoLongerSelected) {
      this.removeZoomedInElements();
      this.zoomToGlobalArea();
      this.redrawFillsAndBorders();
    } else if (zoomInRequested) {
      if (
        didRequestZoomIn ||
        waterRegionSelectedAndChanged ||
        zoomedInDataLoaded
      ) {
        this.removeZoomedInElements();
        this.zoomToWaterRegion();
        this.redrawFillsAndBorders();
      } else if (dataChanged) {
        this.updateWaterRegionData();
      }
    } else {
      // Not zoomed in
      if (dataChanged || waterRegionSelectedAndChanged) {
        this.redrawFillsAndBorders();
      }

      if (selectedWorldRegionChanged) {
        this.zoomToGlobalArea();
      }

      if (didRequestZoomOut) {
        this.removeZoomedInElements();
        this.zoomToGlobalArea();
        this.redrawFillsAndBorders();
      }
    }
  }

  private getHeight() {
    return Math.ceil(this.props.width / 1.9);
  }

  private clearMap() {
    const svg = select<SVGElement, undefined>(this.svgRef);
    svg.select('use#globe-fill').on('click', null);
    svg
      .select<SVGGElement>('g#water-regions')
      .selectAll<SVGPathElement, WaterRegionGeoJSONFeature>('path')
      .remove();
    svg
      .select<SVGGElement>('g#clickable-water-regions')
      .selectAll<SVGPathElement, WaterRegionGeoJSONFeature>('path')
      .remove();
  }

  private async fetchWorldGeoData() {
    try {
      const result = await fetch(worldDataFilename);
      const parsedData: TopoJSON.Topology = await result.json();
      // TODO: improve typings
      this.setState({
        countryGeoData: mesh(parsedData),
        landGeoData: feature(parsedData, parsedData.objects.land) as any,
      });
    } catch (error) {
      console.error('Unable to fetch map data:', error);
    }
  }

  private drawMap() {
    const { landGeoData } = this.state;
    if (!landGeoData) {
      return;
    }

    const {
      selectedWaterRegionId,
      waterRegions: { features },
      width,
    } = this.props;
    const height = this.getHeight();

    // Based on https://gist.github.com/mbostock/4448587
    const projection = geoNaturalEarth1()
      .precision(0.1)
      .scale(width / 4.6)
      .translate([width / 2.2, height / 1.7]);
    const path = geoPath().projection(projection);

    const svg = select<SVGElement, undefined>(this.svgRef);
    svg
      .select<SVGPathElement>('#sphere')
      .datum<GeoSphere>({ type: 'Sphere' })
      .attr('d', path);

    svg.select('use#globe-fill').on('click', () => {
      if (this.props.isZoomedIn) {
        this.props.setZoomedInToRegion(false);
        this.setState({ zoomInRequested: false });
      }
      this.props.clearSelectedRegion();
    });

    // Countries land mass
    svg
      .select<SVGPathElement>('path#land')
      .datum(landGeoData)
      .attr('d', path);

    // Water regions
    // prettier-ignore
    svg
      .select<SVGGElement>('g#water-regions')
      .selectAll<SVGPathElement, WaterRegionGeoJSONFeature>('path')
      .data(features, d => d.properties.featureId.toString())
      .enter()
      .append<SVGPathElement>('path')
        .attr('class', 'water-region')
        .classed(
          'selected',
          d => selectedWaterRegionId === d.properties.featureId,
        )
        .classed(
          'unselected',
          d =>
            selectedWaterRegionId !== undefined &&
            selectedWaterRegionId !== d.properties.featureId,
        )
        .attr('d', path)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('fill', d => this.getColorForWaterRegion(d.properties.featureId));
    svg.select<SVGGElement>('g#water-regions > path.selected').raise();
    svg
      .select<SVGGElement>('g#clickable-water-regions')
      .selectAll<SVGPathElement, WaterRegionGeoJSONFeature>('path')
      .data(features, d => d.properties.featureId.toString())
      .enter()
      .append<SVGPathElement>('path')
      .attr('class', 'clickable-water-region')
      .attr('d', path)
      .on('click', this.handleRegionClick);
  }

  private zoomToGlobalArea(useTransition = true) {
    const { selectedWorldRegion, width } = this.props;
    const height = this.getHeight();
    const svg = select<SVGElement, undefined>(this.svgRef);

    // Based on https://bl.ocks.org/iamkevinv/0a24e9126cd2fa6b283c6f2d774b69a2
    const projection = geoNaturalEarth1()
      .precision(0.1)
      .scale(width / 4.6)
      .translate([width / 2.2, height / 1.7]);

    let bounds;
    svg
      .select<SVGGElement>('g#selected-region')
      .select<SVGPathElement>('path')
      .remove();
    if (selectedWorldRegion) {
      const path = geoPath().projection(projection);
      bounds = path.bounds(selectedWorldRegion.feature);
      svg
        .select<SVGGElement>('g#selected-region')
        .append<SVGPathElement>('path')
        .datum(selectedWorldRegion.feature)
        .attr('d', path);
    } else {
      bounds = [[0, 0], [width, height]];
    }

    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;
    const scale = Math.max(
      1,
      Math.min(8, 0.9 / Math.max(dx / width, dy / height)),
    );
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    const ourZoom = zoom().on('zoom', zoomed);

    const t = transition('zoom').duration(useTransition ? 750 : 0);
    svg
      .transition(t as any)
      .call(
        ourZoom.transform as any,
        zoomIdentity.translate(translate[0], translate[1]).scale(scale),
      );

    function zoomed() {
      svg
        .select<SVGGElement>('g#water-regions')
        .selectAll<SVGPathElement, WaterRegionGeoJSONFeature>('path')
        .classed('hide-fill', false);
      select('g#water-regions').attr('transform', event.transform);
      select('g#clickable-water-regions').attr('transform', event.transform);
      select('g#countries').attr('transform', event.transform);
      select('g#selected-region').attr('transform', event.transform);
    }
  }

  private handleRegionClick = (d: WaterRegionGeoJSONFeature) => {
    // IF the user clicks on the selected region while zoomed in, do nothing.
    if (
      !this.props.isZoomedIn ||
      this.props.selectedWaterRegionId !== d.properties.featureId
    ) {
      this.props.toggleSelectedRegion(d.properties.featureId);
    }
  };

  private toggleZoomInToRegion = () => {
    this.props.setZoomedInToRegion(!this.state.zoomInRequested);
    this.setState(state => ({ zoomInRequested: !state.zoomInRequested }));
  };

  private getColorForWaterRegion(featureId: number): string {
    const { colorScale, selectedData } = this.props;
    if (!selectedData) {
      return missingDataColor;
    }
    const value = selectedData.data[featureId];
    return value != null ? colorScale(value) : missingDataColor;
  }

  private redrawFillsAndBorders() {
    const {
      selectedWaterRegionId,
      waterRegions: { features },
    } = this.props;
    const t = transition('waterRegion').duration(200);
    select('g#water-regions')
      .selectAll<SVGPathElement, WaterRegionGeoJSONFeature>('path')
      .data(features, d => d.properties.featureId.toString())
      .classed(
        'selected',
        d => selectedWaterRegionId === d.properties.featureId,
      )
      .classed(
        'unselected',
        d =>
          selectedWaterRegionId !== undefined &&
          selectedWaterRegionId !== d.properties.featureId,
      )
      .attr('vector-effect', 'non-scaling-stroke')
      .transition(t as any)
      .attr('fill', d => this.getColorForWaterRegion(d.properties.featureId));
    select<SVGPathElement, WaterRegionGeoJSONFeature>(
      'g#water-regions > path.selected',
    ).raise();
  }

  private getScenarioId() {
    const { appType, selectedScenarioId } = this.props;
    // We assume that the scenarioId exists if we're in the PAST page
    return appType === AppType.PAST ? selectedScenarioId! : 'no-scenario';
  }

  private async fetchRegionData(scenarioId: string, regionId: number) {
    const { appType } = this.props;
    const requestId = getRequestId(scenarioId, regionId);
    if (this.state.ongoingRequests.indexOf(requestId) > -1) {
      return;
    }
    this.setState(state => ({
      ongoingRequests: state.ongoingRequests.concat(requestId),
    }));
    const data =
      appType === AppType.FUTURE
        ? await getFutureLocalRegionData(regionId)
        : await getPastLocalRegionData(regionId, scenarioId);
    if (
      data &&
      this.props.selectedWaterRegionId === regionId &&
      this.state.zoomInRequested
    ) {
      this.props.setZoomedInToRegion(true);
    }
    this.setState(state => ({
      ongoingRequests: state.ongoingRequests.filter(id => id !== requestId),
      regionData: data
        ? {
            ...state.regionData,
            [scenarioId]: {
              ...(state.regionData[scenarioId] || {}),
              [regionId]: data,
            },
          }
        : state.regionData,
    }));
  }

  private removeZoomedInElements() {
    const svg = select<SVGElement, undefined>(this.svgRef);

    svg
      .select('g#ddm')
      .selectAll('path')
      .remove();
    svg
      .select('g#rivers')
      .selectAll('path')
      .remove();
    svg
      .select('g#country-borders')
      .selectAll('path')
      .remove();
    svg
      .select('g#country-labels')
      .selectAll('text')
      .remove();
    svg
      .select('g#places')
      .selectAll('path')
      .remove();
    svg
      .select('g#places-labels')
      .selectAll('text')
      .remove();
    svg
      .select('g#grid-data')
      .selectAll('path')
      .remove();
    select(this.mapTooltipRef).style('opacity', 0);
  }

  private updateWaterRegionData() {
    const { countryGeoData, zoomInRequested } = this.state;
    const {
      selectedWaterRegionId,
      selectedGridVariable,
      width,
      waterRegions: { features },
      selectedData,
    } = this.props;

    // FIXME: duplicating the code below from zoomToWaterRegion is ugly
    if (!countryGeoData || !selectedData) {
      return;
    }

    const selectedWaterRegion =
      selectedWaterRegionId != null
        ? features.find(r => r.properties.featureId === selectedWaterRegionId)
        : undefined;

    if (
      !zoomInRequested ||
      selectedWaterRegionId == null ||
      selectedWaterRegion == null
    ) {
      return;
    }

    const scenarioId = this.getScenarioId();

    const localData =
      this.state.regionData[scenarioId] &&
      this.state.regionData[scenarioId][selectedWaterRegionId];
    if (!localData) {
      this.fetchRegionData(scenarioId, selectedWaterRegionId);
      return;
    }

    const height = this.getHeight();
    const svg = select<SVGElement, undefined>(this.svgRef);

    svg
      .select('g#grid-data')
      .selectAll('path')
      .remove();

    this.removeGridLegend();

    if (localData.grid != null && localData.gridQuintiles != null) {
      const quintiles = localData.gridQuintiles[selectedGridVariable];
      if (quintiles != null) {
        // TODO?: projection should be specific to spatial unit
        // Based on https://bl.ocks.org/iamkevinv/0a24e9126cd2fa6b283c6f2d774b69a2
        const projection = geoNaturalEarth1()
          .precision(0.1)
          .scale(width / 4.6)
          .translate([width / 2.2, height / 1.7]);

        const path = geoPath().projection(projection);

        // TODO: might be a more efficient way of doing this?
        const griddataPoly: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
          type: 'FeatureCollection',
          features: localData.grid.map((d: GridData) => ({
            type: 'Feature' as 'Feature',
            geometry: {
              type: 'Polygon' as 'Polygon',
              coordinates: [
                [
                  [d.centre[0] - 0.25, d.centre[1] - 0.25],
                  [d.centre[0] - 0.25, d.centre[1] + 0.25],
                  [d.centre[0] + 0.25, d.centre[1] + 0.25],
                  [d.centre[0] + 0.25, d.centre[1] - 0.25],
                  [d.centre[0] - 0.25, d.centre[1] - 0.25],
                ],
              ],
            },
            properties: {
              data:
                d[selectedGridVariable] &&
                d[selectedGridVariable]![selectedData.startYear],
            },
          })),
        };

        const colorScale = scaleThreshold<number, string>()
          .domain(quintiles)
          .range(gridQuintileColors[selectedGridVariable]);

        const bounds = path.bounds(selectedWaterRegion);
        const dy0 = bounds[1][1] - bounds[0][1];
        const legendMargin = 54;
        bounds[1][1] = bounds[1][1] + (legendMargin / height) * dy0;
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;

        const scale = 0.9 / Math.max(dx / width, dy / height);
        const translate = [width / 2 - scale * x, height / 2 - scale * y];

        const gridDataSelection = svg.select<SVGGElement>('g#grid-data');
        gridDataSelection
          .selectAll<
            SVGPathElement,
            ExtendedFeature<GeoJSON.Polygon, { data: number }>
          >('path')
          .data(griddataPoly.features)
          .enter()
          .append<SVGPathElement>('path')
          .attr('d', path)
          .attr(
            'fill',
            d =>
              d.properties!.data == null
                ? 'none'
                : colorScale(d.properties!.data),
          );
        gridDataSelection.attr(
          'transform',
          `translate(${translate[0]}, ${translate[1]}) scale(${scale})`,
        );

        this.addGridLegend(
          colorScale,
          // The log scale breaks if we pass in 0.
          // FIXME: if the lowest quintile is 0, we won't get a color for it in the scale.
          [Math.max(0.0001, quintiles[0]), quintiles[quintiles.length - 1] * 2],
          labelForGridVariable(selectedGridVariable),
        );
      }
    }
  }

  private zoomToWaterRegion() {
    const { countryGeoData, zoomInRequested } = this.state;
    const {
      selectedWaterRegionId,
      selectedGridVariable,
      width,
      waterRegions: { features },
      selectedData,
    } = this.props;

    if (!countryGeoData || !selectedData) {
      return;
    }

    const selectedWaterRegion =
      selectedWaterRegionId != null
        ? features.find(r => r.properties.featureId === selectedWaterRegionId)
        : undefined;

    if (
      !zoomInRequested ||
      selectedWaterRegionId == null ||
      selectedWaterRegion == null
    ) {
      return;
    }

    const scenarioId = this.getScenarioId();

    const localData =
      this.state.regionData[scenarioId] &&
      this.state.regionData[scenarioId][selectedWaterRegionId];
    if (!localData) {
      this.fetchRegionData(scenarioId, selectedWaterRegionId);
      return;
    }

    const height = this.getHeight();
    const svg = select<SVGElement, undefined>(this.svgRef);
    const svgRef = this.svgRef;

    // TODO?: projection should be specific to spatial unit
    // Based on https://bl.ocks.org/iamkevinv/0a24e9126cd2fa6b283c6f2d774b69a2
    const projection = geoNaturalEarth1()
      .precision(0.1)
      .scale(width / 4.6)
      .translate([width / 2.2, height / 1.7]);

    const path = geoPath().projection(projection);

    // Region dataset is not compatible with land borders -> looks ugly
    svg
      .select<SVGGElement>('g#selected-region')
      .select<SVGPathElement>('path')
      .remove();

    if (localData.ddm != null) {
      svg
        .select('g#ddm')
        .selectAll('path')
        .data(localData.ddm.features)
        .enter()
        .append('path')
        .attr('d', path)
        .classed('ddm-small', d => d.properties.strahler === 1);
    }

    if (localData.rivers != null) {
      const mapTooltipDiv = select(this.mapTooltipRef);
      svg
        .select('g#rivers')
        .selectAll('path')
        .data(localData.rivers.features)
        .enter()
        .append('path')
        .attr('d', path)
        .on('mouseover', d => {
          const svgPos = svgRef.getBoundingClientRect() as DOMRect;
          const url =
            d.properties.enwiki != null
              ? `https://en.wikipedia.org/wiki/${d.properties.enwiki}`
              : `https://en.wikipedia.org/w/index.php?search=${
                  d.properties.name
                }`;
          const tooltipText =
            d.properties.name != null
              ? `<a href= "${url}" target="_blank" class="river-tooltip">${
                  d.properties.name
                }</a>`
              : '(Name unknown)';
          mapTooltipDiv
            .transition()
            .duration(200)
            .style('opacity', 0.9);
          mapTooltipDiv
            .html(tooltipText)
            .style(
              'left',
              event.pageX - svgPos.left - window.scrollX + 5 + 'px',
            )
            .style(
              'top',
              event.pageY - svgPos.top - 10 - window.scrollY + 'px',
            );
        });
    }

    svg
      .select('g#country-borders')
      .append('path')
      // TODO: improve typings
      .attr('d', path(countryGeoData) as any)
      .attr('stroke-dasharray', '0.25 0.25');

    if (localData.countries != null) {
      svg
        .select('g#country-labels')
        .selectAll('text')
        .data(localData.countries.features)
        .enter()
        .append('text')
        .attr(
          'x',
          d => projection(d.geometry.coordinates as [number, number])![0],
        )
        .attr(
          'y',
          d => projection(d.geometry.coordinates as [number, number])![1],
        )
        .attr('filter', 'url(#solid)')
        .text(d => d.properties.countryName);
    }

    if (localData.places != null) {
      const mapTooltipDiv = select(this.mapTooltipRef);
      svg
        .select('g#places')
        .selectAll('path')
        .data(localData.places.features)
        .enter()
        .append('path')
        .attr('d', path.pointRadius(5))
        .attr('fill', '#7b7c95')
        .on('mouseover', function(d) {
          const svgPos = svgRef.getBoundingClientRect() as DOMRect;
          const pos = (this as SVGPathElement).getBoundingClientRect() as DOMRect;
          const url =
            d.properties.enwiki != null
              ? `https://en.wikipedia.org/wiki/${d.properties.enwiki}`
              : `https://en.wikipedia.org/w/index.php?search=${
                  d.properties.name
                }`;
          mapTooltipDiv
            .transition()
            .duration(200)
            .style('opacity', 0.9);
          mapTooltipDiv
            .html(`<a href= "${url}" target="_blank">${d.properties.name}</a>`)
            .style('left', pos.right - svgPos.left + 5 + 'px')
            .style('top', pos.top - pos.height / 2 - svgPos.top + 'px');
          // FIXME: if user never mouses over the tooltip, it won't disappear
          // FIXME: This was being triggered if the user moused over the wikipedia link
          // .on('mouseout', () =>
          //   mapTooltipDiv
          //     .transition()
          //     .duration(200)
          //     .style('opacity', 0),
          // );
        });

      svg
        .select('g#places-labels')
        .selectAll('text')
        .data(
          // Only keep major cities
          // TODO: including other scaleranks?
          localData.places.features.filter(d => d.properties.SCALERANK === 0),
        )
        .enter()
        .append('text')
        .attr(
          'x',
          d => projection(d.geometry.coordinates as [number, number])![0],
        )
        .attr(
          'y',
          d => projection(d.geometry.coordinates as [number, number])![1],
        )
        .attr('dx', 2)
        .attr('filter', 'url(#solid)')
        .text(d => d.properties.name);
    }

    this.removeGridLegend();

    if (localData.grid != null && localData.gridQuintiles != null) {
      const quintiles = localData.gridQuintiles[selectedGridVariable];
      if (quintiles != null) {
        // TODO: might be a more efficient way of doing this?
        const griddataPoly: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
          type: 'FeatureCollection',
          features: localData.grid.map((d: GridData) => ({
            type: 'Feature' as 'Feature',
            geometry: {
              type: 'Polygon' as 'Polygon',
              coordinates: [
                [
                  [d.centre[0] - 0.25, d.centre[1] - 0.25],
                  [d.centre[0] - 0.25, d.centre[1] + 0.25],
                  [d.centre[0] + 0.25, d.centre[1] + 0.25],
                  [d.centre[0] + 0.25, d.centre[1] - 0.25],
                  [d.centre[0] - 0.25, d.centre[1] - 0.25],
                ],
              ],
            },
            properties: {
              data:
                d[selectedGridVariable] &&
                d[selectedGridVariable]![selectedData.startYear],
            },
          })),
        };

        const colorScale = scaleThreshold<number, string>()
          .domain(quintiles)
          .range(gridQuintileColors[selectedGridVariable]);

        svg
          .select<SVGGElement>('g#grid-data')
          .selectAll<
            SVGPathElement,
            ExtendedFeature<GeoJSON.Polygon, { data: number }>
          >('path')
          .data(griddataPoly.features)
          .enter()
          .append<SVGPathElement>('path')
          .attr('d', path)
          .attr(
            'fill',
            d =>
              d.properties!.data == null
                ? 'none'
                : colorScale(d.properties!.data),
          );

        this.addGridLegend(
          colorScale,
          // The log scale breaks if we pass in 0.
          // FIXME: if the lowest quintile is 0, we won't get a color for it in the scale.
          [Math.max(0.0001, quintiles[0]), quintiles[quintiles.length - 1] * 2],
          labelForGridVariable(selectedGridVariable),
        );
      }
    }

    const bounds = path.bounds(selectedWaterRegion);
    const dy0 = bounds[1][1] - bounds[0][1];
    const legendMargin = 54;
    bounds[1][1] = bounds[1][1] + (legendMargin / height) * dy0;
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    const scale = 0.9 / Math.max(dx / width, dy / height);
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    const ourZoom = zoom<SVGElement, undefined>().on('zoom', zoomed);

    const t = transition('zoom').duration(750);
    svg
      .transition(t as any)
      .call(
        ourZoom.transform,
        zoomIdentity.translate(translate[0], translate[1]).scale(scale),
      );

    function zoomed() {
      select('g#water-regions').attr('transform', event.transform);
      svg
        .select<SVGGElement>('g#water-regions')
        .selectAll<SVGPathElement, WaterRegionGeoJSONFeature>('path')
        .classed('hide-fill', true)
        .attr('pointer-events', 'visible');
      select('g#clickable-water-regions').attr('transform', event.transform);
      select('g#countries').attr('transform', event.transform);
      select('g#ddm').attr('transform', event.transform);
      select('g#rivers')
        .attr('transform', event.transform)
        .selectAll('path')
        .attr('stroke-width', `${1.5 / event.transform.k}px`);
      select('g#country-borders')
        .attr('transform', event.transform)
        .selectAll('path')
        .attr('stroke-width', `${1 / event.transform.k}px`);
      select('g#country-labels')
        .attr('transform', event.transform)
        .selectAll('text')
        .attr('font-size', `${12 / event.transform.k}px`);
      select('g#places')
        .attr('transform', event.transform)
        .selectAll<SVGPathElement, any>('path')
        .attr('d', path.pointRadius(5 / event.transform.k));
      select('g#places-labels')
        .attr('transform', event.transform)
        .selectAll('text')
        .attr('dx', 8 / event.transform.k)
        .attr('font-size', `${10 / event.transform.k}px`);
      select('g#grid-data').attr('transform', event.transform);
    }
  }

  private removeGridLegend() {
    select(this.svgRef)
      .select('g#grid-legend')
      .selectAll('*')
      .remove();
  }

  // Based on https://bl.ocks.org/mbostock/4573883
  private addGridLegend(
    colorScale: ScaleThreshold<number, string>,
    valueDomain: number[],
    label: string,
  ) {
    const legendWidth = 240;
    // FIXME: Having a log scale here is a bit ugly, but the quintiles aren't linear
    const legendX = scaleLog()
      .domain(valueDomain)
      .range([0, legendWidth]);

    const xAxis = axisBottom(legendX)
      .tickSize(13)
      .tickValues(colorScale.domain())
      .tickFormat(format('.2s'));

    const g = select('g#grid-legend').call(xAxis as any);
    g.select('.domain').remove();
    g.selectAll('rect.bar')
      .data(
        colorScale.range().map(color => {
          const d = colorScale.invertExtent(color);
          if (d[0] == null) {
            d[0] = legendX.domain()[0];
          }
          if (d[1] == null) {
            d[1] = legendX.domain()[1];
          }
          return d;
        }),
      )
      .enter()
      .insert('rect', '.tick')
      .attr('height', 8)
      .attr('class', 'bar')
      .attr('x', d => legendX(d[0]!))
      .attr('width', d => legendX(d[1]!) - legendX(d[0]!))
      .attr('fill', d => colorScale(d[0]!));

    g.append('text')
      .attr('fill', '#000')
      .attr('font-family', theme.bodyFontFamily)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'start')
      .attr('y', -10)
      .text(label);

    g.insert('rect', '.bar')
      .attr('fill', 'white')
      .attr('opacity', 0.9)
      .attr('width', legendWidth + 30)
      .attr('height', 54)
      .attr('x', -15)
      .attr('y', -28);
  }

  private getScarcityLegend() {
    const { width } = this.props;
    const height = this.getHeight();

    return (
      <ScarcityLegend
        transform={`translate(${Math.round(width * 0.5)}, ${Math.round(
          height - 26,
        )})`}
      >
        <LegendCaption x="0" y="-6">
          Water scarcity
        </LegendCaption>
        <rect
          x="0"
          y="0"
          width="50"
          height="10"
          fill={scarcityColors[0]}
          strokeWidth="0"
        />
        <LegendLabel x="25" y="22" dx="2">
          Stress
        </LegendLabel>
        <rect
          x="50"
          y="0"
          width="115"
          height="10"
          fill={scarcityColors[1]}
          strokeWidth="0"
        />
        <LegendLabel x="108" y="22" dx="2">
          Stress + Shortage
        </LegendLabel>
        <rect
          x="165"
          y="0"
          width="65"
          height="10"
          fill={scarcityColors[2]}
          strokeWidth="0"
        />
        <LegendLabel x="197" y="22" dx="2">
          Shortage
        </LegendLabel>
      </ScarcityLegend>
    );
  }

  private getSpinnerOverlay() {
    const { width } = this.props;
    const height = this.getHeight();
    return (
      <SpinnerOverlay style={{ width: width + 10, height }}>
        <div>
          <Spinner />
        </div>
      </SpinnerOverlay>
    );
  }

  public render() {
    const {
      selectedDataType,
      width,
      selectedWaterRegionId,
      isZoomedIn,
      selectedData,
    } = this.props;
    const { zoomInRequested, landGeoData } = this.state;
    const height = this.getHeight();
    const scenarioId = this.getScenarioId();

    return (
      <Container>
        {!selectedData || !landGeoData ? (
          <div style={{ width, height: height + 3 }}>
            {this.getSpinnerOverlay()}
          </div>
        ) : (
          <>
            <MapTooltip
              innerRef={ref => {
                this.mapTooltipRef = ref;
              }}
            />
            <SVG
              width={width}
              height={height}
              innerRef={ref => {
                this.svgRef = ref;
              }}
            >
              <defs>
                <clipPath id="clip">
                  <use xlinkHref="#sphere" />
                </clipPath>
                <path id="sphere" />
                <filter x="0" y="0" width="1" height="1" id="solid">
                  <feFlood floodColor="#d2e2e6" floodOpacity="0.7" />
                  <feComposite in="SourceGraphic" />
                </filter>
              </defs>
              <use
                id="globe-fill"
                xlinkHref="#sphere"
                style={{ fill: 'transparent' }}
              />
              <g id="countries">
                <Land id="land" clipPath="url(#clip)" />
              </g>
              <g id="grid-data" clipPath="url(#clip)" />
              <DDM id="ddm" clipPath="url(#clip)" />
              <g id="water-regions" clipPath="url(#clip)" />
              <SelectedRegion id="selected-region" clipPath="url(#clip)" />
              <CountryBorders id="country-borders" clipPath="url(#clip)" />
              <g id="clickable-water-regions" clipPath="url(#clip)" />
              <Rivers id="rivers" clipPath="url(#clip)" />
              <g id="places" clipPath="url(#clip)" />
              <CountryLabels id="country-labels" clipPath="url(#clip)" />
              <PlaceLabels id="places-labels" clipPath="url(#clip)" />
              {isZoomedIn ? (
                <g
                  transform={`translate(${width - 400},${height - 30})`}
                  id="grid-legend"
                />
              ) : (
                selectedDataType === 'scarcity' && this.getScarcityLegend()
              )}
            </SVG>
            {/* Note: we currently don't give an error message if loading data fails */}
            {zoomInRequested &&
              selectedWaterRegionId &&
              (!this.state.regionData[scenarioId] ||
                !this.state.regionData[scenarioId][selectedWaterRegionId]) &&
              this.state.ongoingRequests.indexOf(
                getRequestId(scenarioId, selectedWaterRegionId),
              ) > -1 &&
              this.getSpinnerOverlay()}
            {!isZoomedIn &&
              selectedDataType !== 'scarcity' && (
                <StyledThresholdSelector
                  style={{ right: 120, top: height - 48 }}
                  dataType={selectedDataType}
                />
              )}
            {selectedWaterRegionId != null && (
              <ZoomButton onClick={this.toggleZoomInToRegion}>
                {isZoomedIn ? 'Zoom out' : 'Zoom in'}
              </ZoomButton>
            )}
          </>
        )}
      </Container>
    );
  }
}

export default connect<
  GeneratedStateProps,
  GeneratedDispatchProps,
  PassedProps,
  StateTree
>(
  (state, { selectedDataType }) => {
    const thresholds = getThresholdsForDataType(state, selectedDataType);

    return {
      selectedWaterRegionId: getSelectedWaterRegionId(state),
      selectedWorldRegion: getSelectedWorldRegion(state),
      thresholds,
      colorScale: getColorScale(selectedDataType, thresholds),
      stressThresholds: getThresholdsForDataType(state, 'stress'),
      shortageThresholds: getThresholdsForDataType(state, 'shortage'),
      isZoomedIn: isZoomedInToRegion(state),
      selectedGridVariable: getSelectedGridVariable(state),
    };
  },
  dispatch => ({
    toggleSelectedRegion: (regionId: number) => {
      dispatch(toggleSelectedRegion(regionId));
    },
    setZoomedInToRegion: (zoomedIn: boolean) => {
      dispatch(setRegionZoom(zoomedIn));
    },
    clearSelectedRegion: () => {
      dispatch(setSelectedRegion());
    },
  }),
)(Map);
