// tslint:disable:max-line-length

import { FutureDataset, HistoricalDataset } from './types';

// prettier-ignore
const historicalDatasets: HistoricalDataset[] = [
  {
    spatialUnit: 'FPU',
    timeScale: 'annual',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'h08',
    climateModel: 'gfdl-esm2m',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2005',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_annual_bluewater_h08_gfdl-esm2m_hist_pressoc_pirruse_1971_2005.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'annual',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'h08',
    climateModel: 'hadgem2-es',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2004',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_annual_bluewater_h08_hadgem2-es_hist_pressoc_pirruse_1971_2004.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'annual',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'pcrglobwb',
    climateModel: 'gfdl-esm2m',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2005',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_annual_bluewater_pcrglobwb_gfdl-esm2m_hist_pressoc_pirruse_1971_2005.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'annual',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'pcrglobwb',
    climateModel: 'hadgem2-es',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2004',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_annual_bluewater_pcrglobwb_hadgem2-es_hist_pressoc_pirruse_1971_2004.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'annual',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'watergap',
    climateModel: 'gfdl-esm2m',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2005',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_annual_bluewater_watergap_gfdl-esm2m_hist_pressoc_pirruse_1971_2005.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'annual',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'watergap',
    climateModel: 'hadgem2-es',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2004',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_annual_bluewater_watergap_hadgem2-es_hist_pressoc_pirruse_1971_2004.json',
  },
  {
    default: true,
    spatialUnit: 'FPU',
    timeScale: 'decadal',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'watergap',
    climateModel: 'watch',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1901',
    endYear: '2010',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_decadal_bluewater.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'decadal',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'h08',
    climateModel: 'gfdl-esm2m',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2000',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_decadal_bluewater_h08_gfdl-esm2m_hist_pressoc_pirruse_1971_2000.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'decadal',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'h08',
    climateModel: 'hadgem2-es',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2000',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_decadal_bluewater_h08_hadgem2-es_hist_pressoc_pirruse_1971_2000.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'decadal',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'pcrglobwb',
    climateModel: 'gfdl-esm2m',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2000',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_decadal_bluewater_pcrglobwb_gfdl-esm2m_hist_pressoc_pirruse_1971_2000.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'decadal',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'pcrglobwb',
    climateModel: 'hadgem2-es',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2000',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_decadal_bluewater_pcrglobwb_hadgem2-es_hist_pressoc_pirruse_1971_2000.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'decadal',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'watergap',
    climateModel: 'gfdl-esm2m',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2000',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_decadal_bluewater_watergap_gfdl-esm2m_hist_pressoc_pirruse_1971_2000.json',
  },
  {
    spatialUnit: 'FPU',
    timeScale: 'decadal',
    dataType: 'bluewater',
    population: 'hist',
    impactModel: 'watergap',
    climateModel: 'hadgem2-es',
    climateExperiment: 'hist',
    socialForcing: 'pressoc',
    co2Forcing: 'NA',
    startYear: '1971',
    endYear: '2000',
    url: 'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/v2-20171214/FPU_decadal_bluewater_watergap_hadgem2-es_hist_pressoc_pirruse_1971_2000.json',
  },
];

const futureDatasets: FutureDataset[] = [
  // Note: there will be datasets for other variables
  {
    default: true,
    urlTemplateEnsemble:
      'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/futuredata_v3-20180322/ensemble_fpu_decadal/stress/{{featureId}}/all.json',
    urlTemplateScenario:
      'https://s3-eu-west-1.amazonaws.com/lucify-large-files/wasco/futuredata_v3-20180322/scenario_fpu_decadal/' +
      'fpu_decadal_bluewater_{{impactModel}}_{{climateModel}}_{{climateExperiment}}_pressoc_2011_2090/' +
      '{{yieldGap}}_{{dietChange}}_{{foodLossRed}}_{{population}}_{{trade}}_{{agriExp}}_{{reuse}}_{{alloc}}.json',
    variableName: 'stress',
    impactModels: ['h08', 'pcrglobwb', 'watergap'],
    climateModels: ['gfdl-esm2m', 'hadgem2-es'],
    climateExperiments: ['rcp4p5', 'rcp8p5'],
    yieldGaps: ['current', 'medium', 'high'],
    dietChanges: ['current', 'medium', 'high'],
    foodLossReds: ['current', 'medium', 'high'],
    populations: ['SSP1', 'SSP2', 'SSP3'],
    trades: ['none', 'current volume'],
    agriExps: ['current', 'increase'],
    reuses: ['maxfood', 'minwater', 'meetfood'],
    allocs: ['runoff', 'discharge'],
  },
];

export { historicalDatasets, futureDatasets };
