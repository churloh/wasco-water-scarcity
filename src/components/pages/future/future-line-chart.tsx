import * as React from 'react';
import { createSelector } from '../../../../node_modules/reselect';
import {
  FutureDatasetVariables,
  FutureEnsembleData,
  FutureScenario,
  FutureScenarioVariableName,
  isFutureScenarioInComparisonVariables,
  isScenarioEqual,
} from '../../../data';
import { CanvasLineChart } from '../../generic/canvas-line-chart';
import responsive from '../../generic/responsive';
import { theme } from '../../theme';

interface PassedProps {
  className?: string;
  selectedTimeIndex: number;
  selectedScenario: FutureScenario;
  ensembleData: FutureEnsembleData;
  comparisonVariables: FutureDatasetVariables;
  hoveredValue?: string;
  hoveredVariable?: FutureScenarioVariableName;
  onTimeIndexChange: (value: number) => void;
  width?: number;
  height?: number;
}

type Props = PassedProps;

// We only have one globally created memoized selector which won't
// work if we ever decide to add a second future line chart
const getComparisonSeries = createSelector(
  (props: Props) => props.ensembleData,
  (props: Props) => props.comparisonVariables,
  (data, comparisonVariables) => {
    const scenarioFilter = isFutureScenarioInComparisonVariables(
      comparisonVariables,
    );
    return data.filter(scenarioFilter).map(series => ({
      id: series.scenarioId,
      color: theme.colors.grayLight,
      points: series.data.map(d => ({
        value: d.value,
        time: new Date((d.y0 + d.y1) / 2, 0),
      })),
    }));
  },
);

// We only have one globally created memoized selector which won't
// work if we ever decide to add a second future line chart
const getSelectedSeries = createSelector(
  (props: Props) => props.ensembleData,
  (props: Props) => props.selectedScenario,
  (data, selectedScenario) => {
    const datum = data.find(d => isScenarioEqual(selectedScenario, d));
    if (!datum) {
      console.error('Unable to find selected scenario from ensemble');
      return undefined;
    }
    return {
      id: datum.scenarioId,
      color: theme.colors.textSelection,
      points: datum.data.map(d => ({
        value: d.value,
        time: new Date((d.y0 + d.y1) / 2, 0),
      })),
    };
  },
);

// We only have one globally created memoized selector which won't
// work if we ever decide to add a second future line chart
const getHoveredSeries = createSelector(
  (props: Props) => props.ensembleData,
  (props: Props) => props.hoveredValue,
  (props: Props) => props.hoveredVariable,
  (data, hoveredValue, hoveredVariable) => {
    if (!hoveredValue || !hoveredVariable) {
      return undefined;
    }
    return data.filter(d => d[hoveredVariable] === hoveredValue).map(datum => ({
      id: datum.scenarioId,
      color: theme.colors.textHover,
      points: datum.data.map(d => ({
        value: d.value,
        time: new Date((d.y0 + d.y1) / 2, 0),
      })),
    }));
  },
);

function FutureLineChart(props: Props) {
  const { width, height, className } = props;

  const comparisonSeries = getComparisonSeries(props);
  const selectedSeries = getSelectedSeries(props);
  const hoveredSeries = getHoveredSeries(props);

  return (
    <CanvasLineChart
      className={className}
      series={comparisonSeries}
      selectedSeries={selectedSeries}
      hoveredSeries={hoveredSeries}
      width={width || 600}
      height={height || 240}
    />
  );
}

export default responsive(FutureLineChart);
