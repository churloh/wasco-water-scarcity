import { ExtendedFeature, ExtendedFeatureCollection } from 'd3-geo';
import * as GeoJSON from 'geojson';
import { FutureDataType, StressShortageDatum } from '../types';

export interface WorldRegionGeoJSONFeature {
  geometry: any;
  id: number;
  type: 'Feature';
  properties: {
    featureId: number;
    featureName: string;
  };
}

export type HistoricalDataset = HistoricalDatasetVariables & {
  urlTemplateScenario: string;
  default: HistoricalScenario;
};

export type HistoricalDatasetVariables = {
  [variable in HistoricalScenarioVariableName]: string[]
};

export type HistoricalScenario = {
  [variable in HistoricalScenarioVariableName]: string
};

export type HistoricalScenarioVariableName =
  | 'timeScale'
  | 'impactModel'
  | 'climateModel';

export type FutureDatasetVariables = {
  [variable in FutureScenarioVariableName]: string[]
};
export type FutureDataset = FutureDatasetVariables & {
  /**
   * An "ensemble" contains all the scenarios for one FPU/region. The value of the
   * data depends on the area type: for world regions, it's population and for FPUs
   * it's `variableName` data.
   *
   * Used for the line chart.
   */
  urlTemplateEnsemble: string;
  /**
   * A "scenario" is one scenario for all FPU/regions. It includes data for all
   * the `variableName`s.
   *
   * Used for the map.
   */
  urlTemplateScenario: string;
  variableName: FutureDataType[];
};

export type FutureScenario = {
  [variable in FutureScenarioVariableName]: string
};

export type FutureScenarioVariableName =
  | 'population'
  | 'impactModel'
  | 'climateModel'
  | 'climateExperiment'
  | 'yieldGap'
  | 'dietChange'
  | 'foodLossRed'
  | 'trade'
  | 'agriExp'
  | 'reuse'
  | 'alloc';

export const allFutureScenarioVariables: FutureScenarioVariableName[] = [
  'population',
  'impactModel',
  'climateModel',
  'climateExperiment',
  'yieldGap',
  'dietChange',
  'foodLossRed',
  'trade',
  'agriExp',
  'reuse',
  'alloc',
];

export type StressEnsembleThreshold = '0.2' | '0.4' | '0.6' | '0.8' | '1';
export type KcalEnsembleThreshold = 1000 | 1845 | 2355 | 2894 | 4000;

export interface FutureScenarioWithData extends FutureScenario {
  data: Array<{
    y0: number; // start year
    y1: number; // end year
    value: number;
  }>;
}

/**
 * An "ensemble" is all the scenarios for one FPU/region. Used for the line chart.
 */
export type FutureEnsembleData = FutureScenarioWithData[];

interface FutureScenarioRegionDatum {
  pop: number;
  avail: number;
  consIrr: number;
  stress: number;
  kcal: number;
}
/**
 * A "scenario" is one scenario for all FPU/regions. Used for the map.
 */
export type FutureScenarioData = Array<{
  y0: number; // start year
  y1: number; // end year
  data: {
    [regionId: string]: FutureScenarioRegionDatum;
  };
}>;

export interface WorldRegionGeoJSON {
  type: 'FeatureCollection';
  features: WorldRegionGeoJSONFeature[];
  crs: any;
}

export interface WaterRegionGeoJSONFeature {
  geometry: any;
  id: number;
  type: 'Feature';
  properties: {
    featureId: number;
    worldRegionID: number;
  };
}

export interface WaterRegionGeoJSON {
  type: 'FeatureCollection';
  features: WaterRegionGeoJSONFeature[];
  crs: any;
}

export interface RawRegionStressShortageDatum {
  // Independent variables
  id: number; // The FPU ID or the world region ID for aggregates
  y0: number; // start year
  y1: number; // end year

  // Dependent variables
  // Average population
  pop: number;

  // Blue water availability (m3/year)
  avail: number;

  // Blue water consumption for irrigation (km3/year)
  consIrr?: number;
  // Blue water consumption for households and small businesses (domestic )(km3/year)
  consDom?: number;
  // Blue water consumption for thermal electricity production (km3/year)
  consEle?: number;
  // Blue water consumption for livestock farming (km3/year)
  consLiv?: number;
  // Blue water consumption for manufacturing industries (km3/year)
  consMfg?: number;

  // Blue water availability per capita (m3/cap/year). Includes NAs where population=0
  short: number;
  // Blue water consumption-to-availability ratio. Includes NAs where availability=0
  stress: number;
}

const KM_3_TO_M_3_RATIO = 1000000000;

export function toStressShortageDatum({
  y0,
  y1,
  id,
  avail,
  consDom,
  consEle,
  consIrr,
  consLiv,
  consMfg,
  stress,
  short,
  pop,
}: RawRegionStressShortageDatum): StressShortageDatum {
  const domestic = consDom || 0;
  const electric = consEle || 0;
  const irrigation = consIrr || 0;
  const livestock = consLiv || 0;
  const manufacturing = consMfg || 0;
  const calculatedTotal =
    domestic + electric + irrigation + livestock + manufacturing;

  return {
    startYear: y0,
    endYear: y1,
    featureId: id,
    availability: avail,
    consumptionDomestic: domestic * KM_3_TO_M_3_RATIO,
    consumptionElectric: electric * KM_3_TO_M_3_RATIO,
    consumptionIrrigation: irrigation * KM_3_TO_M_3_RATIO,
    consumptionLivestock: livestock * KM_3_TO_M_3_RATIO,
    consumptionManufacturing: manufacturing * KM_3_TO_M_3_RATIO,
    consumptionTotal: calculatedTotal * KM_3_TO_M_3_RATIO,
    stress,
    shortage: short,
    population: pop,
  };
}

interface RiverData {
  name?: string;
  enwiki?: string;
}

interface CountryLabel {
  countryName: string;
}

interface PopulatedPlaces {
  name: string;
  enwiki?: string;
  SCALERANK: number;
}

interface DrainageDirection {
  strahler: number;
}

export type GridData = {
  centre: [number, number];
} & GridDataContents;

type GridDataContents = {
  [key in GridVariable]?: { [startYear: string]: number }
};

type GridQuintile = { [key in GridVariable]?: number[] };
export type GridQuintileColors = { [key in GridVariable]: string[] };
export type GridVariable = 'pop' | 'elec' | 'dom' | 'man' | 'live' | 'irri';

export interface LocalData {
  places?: ExtendedFeatureCollection<
    ExtendedFeature<GeoJSON.Point, PopulatedPlaces>
  >;
  countries?: ExtendedFeatureCollection<
    ExtendedFeature<GeoJSON.Point, CountryLabel>
  >;
  rivers?: ExtendedFeatureCollection<
    ExtendedFeature<GeoJSON.MultiLineString, RiverData>
  >;
  ddm?: ExtendedFeatureCollection<
    ExtendedFeature<GeoJSON.Point, DrainageDirection>
  >;
  grid?: GridData[];
  gridQuintiles?: GridQuintile;
}
