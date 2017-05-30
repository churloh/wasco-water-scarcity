import * as React from 'react';
import { RouteComponentProps } from 'react-router';

import Map from './map';
import TimeSelector from './time-selector';

import * as styles from './app.scss';

type PassedProps = RouteComponentProps<void>;

type Props = PassedProps;

class App extends React.Component<Props, void> {
  public render() {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <h1>Blue water stress</h1>
          <TimeSelector />
        </div>
        <div className={styles.content}>
          <Map />
        </div>
        <div className={styles.footer} />
      </div>
    );
  }
}

export default App;
