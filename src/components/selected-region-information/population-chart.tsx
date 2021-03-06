import * as React from 'react';
import { createSelector } from 'reselect';
import { Datum } from '../../types';
import { formatPopulation, formatYearRange } from '../../utils';
import BarChart, { BarChartDatum } from '../generic/bar-chart';

interface PassedProps {
  data: Datum[];
  selectedTimeIndex: number;
  timeIndexLocked?: boolean;
  onToggleLock?: () => void;
  onTimeIndexChange: (value: number) => void;
  maxY?: number;
}

type Props = PassedProps;

export default class PopulationChart extends React.PureComponent<Props> {
  private generateBarChartData = createSelector(
    (props: Props) => props.data,
    data =>
      data.map((d, i) => ({
        key: i,
        total: d.population,
        values: [
          {
            key: 'Population',
            total: d.population,
            color: '#D3E4E6',
          },
        ],
      })),
  );

  private handleClick = (item: BarChartDatum) => {
    const { onToggleLock, onTimeIndexChange } = this.props;
    if (onToggleLock) {
      onToggleLock();
    }
    onTimeIndexChange(item.key);
  };

  public render() {
    const {
      data,
      selectedTimeIndex,
      onTimeIndexChange,
      maxY,
      timeIndexLocked,
    } = this.props;
    const barChartData: BarChartDatum[] = this.generateBarChartData(this.props);

    function handleHover(item: BarChartDatum) {
      onTimeIndexChange(item.key);
    }

    function xTickFormatter(i: string) {
      const d = data[Number(i)];
      return formatYearRange(d);
    }

    return (
      <BarChart
        data={barChartData}
        maxYValue={maxY}
        height={180}
        marginBottom={20}
        marginRight={0}
        marginTop={15}
        marginLeft={40}
        yTickFormat={formatPopulation}
        xTickFormat={xTickFormatter}
        selectedIndex={selectedTimeIndex}
        indexLocked={timeIndexLocked}
        onClick={this.handleClick}
        onMouseEnter={handleHover}
        transitionDuration={100}
      />
    );
  }
}
