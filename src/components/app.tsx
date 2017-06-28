import * as React from 'react';
import { connect } from 'react-redux';
import { Redirect, Route, RouteComponentProps, Switch } from 'react-router-dom';

import { loadAppData, loadModelData } from '../actions';
import { StateTree } from '../reducers';
import {
  getSelectedClimateModel,
  getSelectedImpactModel,
  getSelectedTimeScale,
} from '../selectors';
import Header from './header';
import Future from './pages/future';
import NotFound from './pages/not-found';
import Scarcity from './pages/scarcity';
import Shortage from './pages/shortage';
import Stress from './pages/stress';

import * as styles from './app.scss';

type PassedProps = RouteComponentProps<void>;

interface GeneratedDispatchProps {
  loadAppData: (
    climateModel: string,
    impactModel: string,
    timeScale: string,
  ) => void;
  loadModelData: (
    climateModel: string,
    impactModel: string,
    timeScale: string,
  ) => void;
}

interface GeneratedStateProps {
  selectedImpactModel: string;
  selectedClimateModel: string;
  selectedTimeScale: string;
}

type Props = PassedProps & GeneratedDispatchProps & GeneratedStateProps;

class App extends React.Component<Props, void> {
  public componentDidMount() {
    const {
      loadAppData,
      selectedClimateModel,
      selectedImpactModel,
      selectedTimeScale,
    } = this.props;

    loadAppData(selectedClimateModel, selectedImpactModel, selectedTimeScale);
  }

  public componentWillReceiveProps(nextProps: Props) {
    const {
      selectedClimateModel,
      selectedImpactModel,
      selectedTimeScale,
      loadModelData,
    } = this.props;

    if (
      selectedClimateModel !== nextProps.selectedClimateModel ||
      selectedImpactModel !== nextProps.selectedImpactModel ||
      selectedTimeScale !== nextProps.selectedTimeScale
    ) {
      loadModelData(
        nextProps.selectedClimateModel,
        nextProps.selectedImpactModel,
        nextProps.selectedTimeScale,
      );
    }
  }

  public render() {
    // tslint:disable:jsx-no-lambda

    return (
      <div className={styles.root}>
        <Header />
        <div className="container">
          <Switch>
            {/* These routes also handle any data loading or other onLoad trigger */}
            <Route path="/stress" exact component={Stress} />
            <Route path="/shortage" exact component={Shortage} />
            <Route path="/scarcity" exact component={Scarcity} />
            <Route path="/future" exact component={Future} />
            <Route path="/" exact render={() => <Redirect to="/stress" />} />
            <Route
              path="/stress/uncertainty"
              exact
              render={() => <Redirect to="/stress" />}
            />
            <Route
              path="/shortage/uncertainty"
              exact
              render={() => <Redirect to="/shortage" />}
            />
            <Route
              path="/future/stress"
              exact
              render={() => <Redirect to="/future" />}
            />
            <Route
              path="/future/shortage"
              exact
              render={() => <Redirect to="/future" />}
            />
            <Route
              path="/future/scarcity"
              exact
              render={() => <Redirect to="/future" />}
            />
            <Route component={NotFound} />
          </Switch>
        </div>
      </div>
    );
  }
}

export default connect<
  GeneratedStateProps,
  GeneratedDispatchProps,
  PassedProps
>(
  (state: StateTree) => ({
    selectedClimateModel: getSelectedClimateModel(state),
    selectedImpactModel: getSelectedImpactModel(state),
    selectedTimeScale: getSelectedTimeScale(state),
  }),
  { loadAppData, loadModelData },
)(App);
