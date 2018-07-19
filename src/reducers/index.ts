import { isEqual } from 'lodash';
import { combineReducers } from 'redux';
import { Action } from '../actions';
import {
  defaultDataTypeThresholds,
  getDefaultHistoricalClimateModel,
  getDefaultHistoricalImpactModel,
  getHistoricalClimateModels,
} from '../data';
import { DataTree, SelectionsTree, StateTree, ThresholdsTree } from './types';

const defaultState: StateTree = {
  data: {},
  thresholds: {
    stress: [...defaultDataTypeThresholds.stress],
    shortage: [...defaultDataTypeThresholds.shortage],
    scarcity: [...defaultDataTypeThresholds.scarcity],
    kcal: [...defaultDataTypeThresholds.kcal],
  },
  selections: {
    historicalTimeIndex: 0,
    lockHistoricalTimeIndex: false,
    impactModel: getDefaultHistoricalImpactModel(),
    climateModel: getDefaultHistoricalClimateModel(),
    timeScale: 'decadal',
    historicalDataType: 'stress',
    worldRegion: 0, // 0 means global
  },
};

export const initialState = defaultState;

function dataReducer(state = initialState.data, action: Action): DataTree {
  switch (action.type) {
    case 'STORE_WATER_DATA':
      return {
        ...state,
        stressShortageData: action.data,
      };
    case 'STORE_WATER_REGION_DATA':
      return {
        ...state,
        waterRegions: action.data,
      };
    case 'STORE_WORLD_REGION_DATA':
      return {
        ...state,
        worldRegions: action.data,
      };
    case 'STORE_WATER_TO_WORLD_REGION_MAP':
      return {
        ...state,
        waterToWorldRegionsMap: action.map,
      };
  }
  return state;
}

function thresholdsReducer(
  state = initialState.thresholds,
  action: Action,
): ThresholdsTree {
  switch (action.type) {
    case 'SET_THRESHOLDS_FOR_DATA_TYPE':
      if (!isEqual(state[action.dataType], action.thresholds)) {
        return {
          ...state,
          [action.dataType]: action.thresholds,
        };
      }
  }
  return state;
}

function selectionsReducer(
  state = initialState.selections,
  action: Action,
): SelectionsTree {
  switch (action.type) {
    case 'SET_HISTORICAL_TIME_INDEX':
      if (
        !state.lockHistoricalTimeIndex &&
        action.value !== state.historicalTimeIndex
      ) {
        return {
          ...state,
          historicalTimeIndex: action.value,
        };
      }

      return state;
    case 'STORE_WATER_DATA':
      // When we load a new data set, set the selected time index to the latest
      // time period
      return {
        ...state,
        historicalTimeIndex: action.data.length - 1,
      };
    case 'TOGGLE_SELECTED_REGION':
      if (state.region === action.id) {
        return {
          ...state,
          region: undefined,
        };
      }

      return {
        ...state,
        region: action.id,
      };
    case 'SET_SELECTED_REGION':
      if (action.id !== state.region) {
        return {
          ...state,
          region: action.id,
        };
      }

      return state;
    case 'SET_SELECTED_WORLD_REGION':
      if (action.id !== state.worldRegion) {
        return {
          ...state,
          // Clear selected region
          region: undefined,
          worldRegion: action.id,
        };
      }

      return state;
    case 'SET_SELECTED_HISTORICAL_DATA_TYPE':
      if (action.dataType !== state.historicalDataType) {
        return {
          ...state,
          historicalDataType: action.dataType,
        };
      }

      return state;
    case 'SET_SELECTED_IMPACT_MODEL':
      if (action.impactModel !== state.impactModel) {
        let { climateModel } = state;

        // If watch was previously selected, we need to switch to a
        // valid climateModel.
        if (climateModel === 'watch') {
          climateModel = getHistoricalClimateModels().filter(
            m => m !== 'watch',
          )[0];
        }

        return {
          ...state,
          climateModel,
          impactModel: action.impactModel,
        };
      }

      return state;
    case 'SET_SELECTED_CLIMATE_MODEL':
      if (action.climateModel !== state.climateModel) {
        let { impactModel, timeScale } = state;

        if (action.climateModel === 'watch') {
          impactModel = 'watergap';
          timeScale = 'decadal';
        }

        return {
          ...state,
          timeScale,
          impactModel,
          climateModel: action.climateModel,
        };
      }

      return state;
    case 'SET_SELECTED_TIME_SCALE':
      if (action.timeScale !== state.timeScale) {
        if (action.timeScale === 'annual' && state.climateModel === 'watch') {
          // WATCH dataset only has decadal data
          return state;
        }

        return {
          ...state,
          timeScale: action.timeScale,
        };
      }

      return state;
    case 'TOGGLE_HISTORICAL_TIME_INDEX_LOCK':
      return {
        ...state,
        lockHistoricalTimeIndex: !state.lockHistoricalTimeIndex,
      };
  }

  return state;
}

export default combineReducers<StateTree>({
  selections: selectionsReducer,
  thresholds: thresholdsReducer,
  data: dataReducer,
});

export * from './types';
