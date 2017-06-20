import { RouterState } from 'react-router-redux';

import { WaterRegionGeoJSON } from '../data/types';
import {
  DataType,
  StressShortageDatum,
  TimeAggregate,
  WorldRegion,
} from '../types';

export interface StateTree {
  data: {
    stressShortageData?: Array<TimeAggregate<StressShortageDatum>>;
    worldRegions?: WorldRegion[];
    waterRegions?: WaterRegionGeoJSON;
    waterToWorldRegionsMap?: { [waterId: number]: number };
  };
  routing: RouterState;
  thresholds: {
    stress: number[];
    shortage: number[];
    scarcity: number[];
  };
  selections: {
    timeIndex: number;
    dataType: DataType;
    impactModel: string;
    climateModel: string;
    worldRegion: number;
    region?: number;
  };
}
