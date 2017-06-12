export interface TimeAggregate {
  startYear: number;
  endYear: number;
  data: {
    [featureId: number]: StressShortageDatum;
  };
}

export interface RawRegionStressShortageDatum {
  // Independent variables
  featureid: number;
  startYear: number;
  endYear: number;

  // Dependent variabls
  worldRegionID: number;
  // Average population
  population: number;
  // Blue water availability per capita (m3/cap/year). Includes NAs where population=0
  blueWaterShortage: number;
  // Blue water consumption-to-availability ratio. Includes NAs where availability=0
  blueWaterStress: number;
  // Blue water availability (m3/year)
  blueWaterAvailability: number;
  // Total blue water consumption (km3/year)
  blueWaterConsumptionTotal: number;
  // Blue water consumption for irrigation (km3/year)
  blueWaterConsumptionIrrigation: number;
  // Blue water consumption for households and small businesses (domestic )(km3/year)
  blueWaterConsumptionDomestic: number;
  // Blue water consumption for thermal electricity production (km3/year)
  blueWaterConsumptionElectric: number;
  // Blue water consumption for livestock farming (km3/year)
  blueWaterConsumptionLivestock: number;
  // Blue water consumption for manufacturing industries (km3/year)
  blueWaterConsumptionManufacturing: number;
}

export interface RawAggregateStressShortageDatum {
  // Independent variables
  // This is the worldRegionId in RawRegionStressShortageDatum. Set to 0 for the whole world.
  featureId: number;
  startYear: number;
  endYear: number;

  // Dependent variables
  // Average population
  population: number;
  // aggregated from finer scale data: sum(population[blueWaterShortage<=1700 & blueWaterStress<0.2])
  populationOnlyBlueWaterShortage: number;
  // aggregated from finer scale data: sum(population[blueWaterShortage>1700 & blueWaterStress>=0.2])
  populationOnlyBlueWaterStress: number;
  // aggregated from finer scale data: sum(population[blueWaterShortage<=1700 & blueWaterStress>=0.2])
  populationBlueWaterShortageAndStress: number;
  // aggregated from finer scale data: sum(population[blueWaterShortage<=1700 & blueWaterShortage>1000])
  populationModerateBlueWaterShortage: number;
  // aggregated from finer scale data: sum(population[blueWaterShortage<=1000])
  populationHighBlueWaterShortage: number;
  // aggregated from finer scale data: sum(population[blueWaterStress>=0.2 & blueWaterStress<0.4])
  populationModerateBlueWaterStress: number;
  // aggregated from finer scale data: sum(population[blueWaterStress>=0.4])
  populationHighBlueWaterStress: number;
  populationNoBlueWaterShortageAndStress: number;
  populationNoBlueWaterShortage: number;
  populationNoBlueWaterStress: number;
  // Blue water availability (m3/year)
  blueWaterAvailability: number;
  // Total blue water consumption (km3/year)
  blueWaterConsumptionTotal: number;
  // Blue water consumption for irrigation (km3/year)
  blueWaterConsumptionIrrigation: number;
  // Blue water consumption for households and small businesses (domestic )(km3/year)
  blueWaterConsumptionDomestic: number;
  // Blue water consumption for thermal electricity production (km3/year)
  blueWaterConsumptionElectric: number;
  // Blue water consumption for livestock farming (km3/year)
  blueWaterConsumptionLivestock: number;
  // Blue water consumption for manufacturing industries (km3/year)
  blueWaterConsumptionManufacturing: number;
}

// All units have been converted to m^3 from km^3
export interface StressShortageDatum {
  startYear: number;
  endYear: number;
  featureId: number;
  population: number;
  blueWaterShortage: number;
  blueWaterStress: number;
  blueWaterAvailability: number;
  blueWaterConsumptionTotal: number;
  /**
   * This is a sum of the consumptions. It may differ slightly from
   * blueWaterConsumptionTotal due to rounding and floating numbers.
   */
  blueWaterConsumptionCalculatedTotal: number;
  blueWaterConsumptionIrrigation: number;
  blueWaterConsumptionDomestic: number;
  blueWaterConsumptionElectric: number;
  blueWaterConsumptionLivestock: number;
  blueWaterConsumptionManufacturing: number;
}

const KM_3_TO_M_3_RATIO = 1000000000;

export function toStressShortageDatum({
  startYear,
  endYear,
  featureid,
  blueWaterAvailability,
  blueWaterConsumptionDomestic,
  blueWaterConsumptionElectric,
  blueWaterConsumptionIrrigation,
  blueWaterConsumptionLivestock,
  blueWaterConsumptionManufacturing,
  blueWaterConsumptionTotal,
  blueWaterStress,
  blueWaterShortage,
  population,
}: RawRegionStressShortageDatum): StressShortageDatum {
  const calculatedTotal =
    blueWaterConsumptionDomestic +
    blueWaterConsumptionElectric +
    blueWaterConsumptionIrrigation +
    blueWaterConsumptionLivestock +
    blueWaterConsumptionManufacturing;

  return {
    startYear,
    endYear,
    featureId: featureid,
    blueWaterAvailability,
    blueWaterConsumptionDomestic:
      blueWaterConsumptionDomestic * KM_3_TO_M_3_RATIO,
    blueWaterConsumptionElectric:
      blueWaterConsumptionElectric * KM_3_TO_M_3_RATIO,
    blueWaterConsumptionIrrigation:
      blueWaterConsumptionIrrigation * KM_3_TO_M_3_RATIO,
    blueWaterConsumptionLivestock:
      blueWaterConsumptionLivestock * KM_3_TO_M_3_RATIO,
    blueWaterConsumptionManufacturing:
      blueWaterConsumptionManufacturing * KM_3_TO_M_3_RATIO,
    blueWaterConsumptionTotal: blueWaterConsumptionTotal * KM_3_TO_M_3_RATIO,
    blueWaterConsumptionCalculatedTotal: calculatedTotal,
    blueWaterStress,
    blueWaterShortage,
    population,
  };
}

export type DataType = keyof StressShortageDatum;
export function getDataTypeThresholds(dataType: DataType) {
  switch (dataType) {
    case 'blueWaterStress':
      return [0.2, 0.4, 1];
    case 'blueWaterShortage':
      return [500, 1000, 1700]; // Note: higher is better.
  }

  console.warn('No thresholds availables for', dataType);
  return undefined;
}
