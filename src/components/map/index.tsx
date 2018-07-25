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
import { feature } from 'topojson';
import {
  setRegionZoom,
  setSelectedRegion,
  toggleSelectedRegion,
} from '../../actions';
import {
  belowThresholdColor,
  getDataTypeColors,
  getLocalRegionData,
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
import { AnyDataType, TimeAggregate, WorldRegion } from '../../types';
import Spinner from '../generic/spinner';
import { theme } from '../theme';
import ThresholdSelector from '../threshold-selector';

const worldData = require('world-atlas/world/110m.json');

const Container = styled.div`
  position: relative;
`;

const StyledThresholdSelector = styled(ThresholdSelector)`
  position: absolute;
`;

const ZoomButton = styled.button`
  position: absolute;
  right: 20px;
  bottom: 5px;

  background: transparent;
  border-radius: 4px;
  color: white;
  padding: 5px 10px;
  text-align: center;
  font-size: 16px;
  cursor: pointer;
  text-decoration: none;
  text-transform: uppercase;
  background-color: white;
  color: ${theme.colors.text};
  border: 2px solid ${theme.colors.gray};

  &:hover {
    background-color: ${theme.colors.gray};
    color: white;
  }

  &:focus {
    outline: 0;
  }
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

const SVG = styled.svg`
  & .water-region {
    stroke-width: 0.5px;
    stroke: #ecf4f8;
    transition: opacity 0.2s ease-in;

    &.selected {
      stroke: black;
      transition: opacity 0.2s ease-out;
    }
    &.unselected {
      opacity: 0.5;
      transition: opacity 0.2s ease-out;
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
  stroke-width: 1px;
  stroke: black;
  fill: none;
`;

const DDM = styled.g`
  stroke-width: 0.25px;
  stroke: #71bcd5;
  opacity: 0.8;
  fill: none;
`;

const Rivers = styled.g`
  stroke-width: 0.5px;
  stroke: blue;
  fill: none;
`;

const Basins = styled.g`
  stroke-width: 0.5px;
  stroke: purple;
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

interface PassedProps {
  width: number;
  selectedData: TimeAggregate<number | undefined>;
  waterRegions: WaterRegionGeoJSON;
  selectedDataType: AnyDataType;
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
    [id: string]: LocalData | undefined;
  };
  fetchingDataForRegions: number[];
  zoomInRequested: boolean;
}

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

class Map extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      regionData: {},
      fetchingDataForRegions: [],
      zoomInRequested: props.isZoomedIn,
    };
  }

  private svgRef!: SVGElement;

  public componentDidMount() {
    this.drawMap();
    this.zoomToGlobalArea(false);
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
    const { zoomInRequested, regionData } = this.state;

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
      regionData[selectedWaterRegionId] &&
      !prevState.regionData[selectedWaterRegionId];
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
    } else {
      // Width has stayed the same
      if (zoomInRequested) {
        if (
          didRequestZoomIn ||
          waterRegionSelectedAndChanged ||
          zoomedInDataLoaded ||
          dataChanged
        ) {
          this.removeZoomedInElements();
          this.zoomToWaterRegion();
        }
      } else {
        // Not zoomed in
        if (
          dataChanged ||
          waterRegionSelectedAndChanged ||
          waterRegionNoLongerSelected
        ) {
          this.redrawFillsAndBorders();
        }

        if (waterRegionNoLongerSelected || selectedWorldRegionChanged) {
          this.zoomToGlobalArea();
        }

        if (didRequestZoomOut) {
          this.removeZoomedInElements();
          this.zoomToGlobalArea();
          this.redrawFillsAndBorders();
        }
      }
    }
  }

  private getHeight() {
    return this.props.width / 1.9;
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

  private drawMap() {
    const {
      clearSelectedRegion,
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

    svg.select('use#globe-fill').on('click', clearSelectedRegion);

    // Countries land mass
    svg
      .select<SVGPathElement>('path#land')
      .datum(feature(worldData, worldData.objects.land))
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
        .style('visibility', 'visible');
      select<SVGGElement, undefined>('g#water-regions').attr(
        'transform',
        event.transform,
      );
      select<SVGGElement, undefined>('g#clickable-water-regions').attr(
        'transform',
        event.transform,
      );
      select<SVGGElement, undefined>('g#countries').attr(
        'transform',
        event.transform,
      );
      select<SVGGElement, undefined>('g#selected-region').attr(
        'transform',
        event.transform,
      );
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
    if (this.state.zoomInRequested) {
      this.props.setZoomedInToRegion(false);
    }
    this.setState(state => ({ zoomInRequested: !state.zoomInRequested }));
  };

  private getColorForWaterRegion(featureId: number): string {
    const {
      colorScale,
      selectedData: { data },
    } = this.props;
    const value = data[featureId];
    return value != null ? colorScale(value) : missingDataColor;
  }

  private redrawFillsAndBorders() {
    const {
      selectedWaterRegionId,
      waterRegions: { features },
    } = this.props;
    const t = transition('waterRegion').duration(100);
    select<SVGGElement, undefined>('g#water-regions')
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
      .transition(t as any)
      .attr('fill', d => this.getColorForWaterRegion(d.properties.featureId));
  }

  private async fetchRegionData(regionId: number) {
    if (this.state.fetchingDataForRegions.indexOf(regionId) > -1) {
      return;
    }
    this.setState(state => ({
      fetchingDataForRegions: state.fetchingDataForRegions.concat(regionId),
    }));
    const data = await getLocalRegionData(regionId);
    this.setState(state => ({
      fetchingDataForRegions: state.fetchingDataForRegions.filter(
        id => id !== regionId,
      ),
      regionData: data
        ? {
            ...state.regionData,
            [regionId]: data,
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
      .select('g#basins')
      .selectAll('path')
      .remove();
    svg
      .select('g#basin-labels')
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
  }

  private zoomToWaterRegion() {
    const {
      selectedWaterRegionId,
      selectedGridVariable,
      width,
      waterRegions: { features },
      selectedData: { startYear },
    } = this.props;
    const { zoomInRequested } = this.state;

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

    const localData = this.state.regionData[selectedWaterRegionId];
    if (!localData) {
      this.fetchRegionData(selectedWaterRegionId);
      return;
    }

    // Having this side effect here is ugly
    this.props.setZoomedInToRegion(true);

    const height = this.getHeight();
    const svg = select<SVGElement, undefined>(this.svgRef);

    // TODO?: projection should be specific to spatial unit
    // Based on https://bl.ocks.org/iamkevinv/0a24e9126cd2fa6b283c6f2d774b69a2
    const projection = geoNaturalEarth1()
      .precision(0.1)
      .scale(width / 4.6)
      .translate([width / 2.2, height / 1.7]);

    const path = geoPath().projection(projection);

    if (localData.ddm != null) {
      svg
        .select('g#ddm')
        .selectAll('path')
        .data(localData.ddm.features)
        .enter()
        .append('path')
        .attr('d', path);
    }

    if (localData.rivers != null) {
      svg
        .select('g#rivers')
        .selectAll('path')
        .data(localData.rivers.features)
        .enter()
        .append('path')
        .attr('d', path);
    }

    if (localData.countries != null) {
      svg
        .select('g#country-borders')
        .selectAll('path')
        .data(localData.countries.features)
        .enter()
        .append('path')
        .attr('d', path);

      svg
        .select('g#country-labels')
        .selectAll('text')
        .data(localData.countries.features)
        .enter()
        .append('text')
        .attr('x', d => path.centroid(d)[0])
        .attr('y', d => path.centroid(d)[1])
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .text(d => d.properties.countryName);
    }

    if (localData.basins != null) {
      svg
        .select('g#basins')
        .selectAll('path')
        .data(localData.basins.features)
        .enter()
        .append('path')
        .attr('d', path);

      svg
        .select('g#basin-labels')
        .selectAll('text')
        .data(localData.basins.features)
        .enter()
        .append('text')
        .attr('x', d => path.centroid(d)[0])
        .attr('y', d => path.centroid(d)[1])
        .style('fill', 'purple')
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .text(d => d.properties.basinName);
    }

    if (localData.places != null) {
      svg
        .select('g#places')
        .selectAll('path')
        .data(localData.places.features)
        .enter()
        .append('path')
        .attr('d', path.pointRadius(5))
        .attr('fill', 'grey');

      svg
        .select('g#places-labels')
        .selectAll('text')
        .data(localData.places.features)
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
        .attr('text-anchor', 'left')
        .attr('dx', 2)
        .attr('font-size', '10px')
        .text(d => d.properties.name);
    }

    this.removeGridLegend();

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
              d[selectedGridVariable] && d[selectedGridVariable]![startYear],
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

    const bounds = path.bounds(selectedWaterRegion);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    const scale = 0.9 / Math.max(dx / width, dy / height);
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    const ourZoom = zoom().on('zoom', zoomed);

    const t = transition('zoom').duration(750);
    svg
      .transition(t as any)
      .call(
        ourZoom.transform as any,
        zoomIdentity.translate(translate[0], translate[1]).scale(scale),
      );

    function zoomed() {
      select<SVGGElement, undefined>('g#water-regions').attr(
        'transform',
        event.transform,
      );
      // TODO: There's probably a better way of clearing the water region fill
      svg
        .select<SVGGElement>('g#water-regions')
        .selectAll<SVGPathElement, WaterRegionGeoJSONFeature>('path')
        .style('visibility', 'hidden')
        .attr('pointer-events', 'visible');
      select<SVGGElement, undefined>('g#clickable-water-regions').attr(
        'transform',
        event.transform,
      );
      select<SVGGElement, undefined>('g#countries').attr(
        'transform',
        event.transform,
      );
      select<SVGGElement, undefined>('g#selected-region').attr(
        'transform',
        event.transform,
      );
      select<SVGGElement, undefined>('g#ddm')
        .attr('transform', event.transform)
        .selectAll('path')
        .attr('stroke-width', `${1.5 / event.transform.k}px`);
      select<SVGGElement, undefined>('g#rivers')
        .attr('transform', event.transform)
        .selectAll('path')
        .attr('stroke-width', `${1.5 / event.transform.k}px`);
      select<SVGGElement, undefined>('g#country-borders')
        .attr('transform', event.transform)
        .selectAll('path')
        .attr('stroke-width', `${1 / event.transform.k}px`);
      select<SVGGElement, undefined>('g#country-labels')
        .attr('transform', event.transform)
        .selectAll('text')
        .attr('font-size', `${12 / event.transform.k}px`);
      select<SVGGElement, undefined>('g#basins')
        .attr('transform', event.transform)
        .selectAll('path')
        .attr('stroke-width', `${1 / event.transform.k}px`);
      select<SVGGElement, undefined>('g#basin-labels')
        .attr('transform', event.transform)
        .selectAll('text')
        .attr('font-size', `${12 / event.transform.k}px`);
      select<SVGGElement, undefined>('g#places')
        .attr('transform', event.transform)
        .selectAll<SVGPathElement, any>('path')
        .attr('d', path.pointRadius(5 / event.transform.k));
      select<SVGGElement, undefined>('g#places-labels')
        .attr('transform', event.transform)
        .selectAll('text')
        .attr('dx', 8 / event.transform.k)
        .attr('font-size', `${10 / event.transform.k}px`);
      select<SVGGElement, undefined>('g#grid-data').attr(
        'transform',
        event.transform,
      );
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

  public render() {
    const {
      selectedDataType,
      width,
      selectedWaterRegionId,
      isZoomedIn,
    } = this.props;
    const { zoomInRequested } = this.state;
    const height = this.getHeight();
    // Even though zoomInToRegion might be true, we might not have the data loaded,
    // in which case we're not yet zoomed in

    return (
      <Container>
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
          </defs>
          <use id="globe-fill" xlinkHref="#sphere" style={{ fill: 'white' }} />
          <g id="countries">
            <Land id="land" clipPath="url(#clip)" />
          </g>
          <g id="water-regions" clipPath="url(#clip)" />
          <g id="grid-data" clipPath="url(#clip)" />
          <SelectedRegion id="selected-region" clipPath="url(#clip)" />
          <CountryBorders id="country-borders" clipPath="url(#clip)" />
          <Basins id="basins" clipPath="url(#clip)" />
          <g id="basin-labels" clipPath="url(#clip)" />
          <g id="country-labels" clipPath="url(#clip)" />
          <DDM id="ddm" clipPath="url(#clip)" />
          <Rivers id="rivers" clipPath="url(#clip)" />
          <g id="places" clipPath="url(#clip)" />
          <g id="places-labels" clipPath="url(#clip)" />
          {isZoomedIn ? (
            <g
              transform={`translate(${width - 400},${height - 30})`}
              id="grid-legend"
            />
          ) : (
            selectedDataType === 'scarcity' && this.getScarcityLegend()
          )}
          <g id="clickable-water-regions" clipPath="url(#clip)" />
        </SVG>
        {/* Note: we currently don't give an error message if loading data fails */}
        {zoomInRequested &&
          selectedWaterRegionId &&
          !this.state.regionData[selectedWaterRegionId] &&
          this.state.fetchingDataForRegions.indexOf(selectedWaterRegionId) >
            -1 && (
            <SpinnerOverlay style={{ width: width + 10, height }}>
              <div>
                <p>Loading...</p>
                <Spinner />
              </div>
            </SpinnerOverlay>
          )}
        {!isZoomedIn &&
          selectedDataType !== 'scarcity' && (
            <StyledThresholdSelector
              style={{ left: width * 0.5, top: height - 40 }}
              dataType={selectedDataType}
            />
          )}
        {selectedWaterRegionId && (
          <ZoomButton onClick={this.toggleZoomInToRegion}>
            {isZoomedIn ? 'Zoom out' : 'Zoom in'}
          </ZoomButton>
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
