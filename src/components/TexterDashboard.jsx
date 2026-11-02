import PropTypes from "prop-types";
import React from "react";
import { withRouter } from "react-router";
import ShoreShell from "./ShoreShell/ShoreShell";

// Texter pages inside the Shore shell. The texting screens themselves
// (fullScreen) stay full screen, without the sidebar, so texters can focus.
class TexterDashboard extends React.Component {
  render() {
    const { main, topNav, fullScreen, params, location } = this.props;
    if (fullScreen) {
      return fullScreen;
    }
    return (
      <ShoreShell
        organizationId={params && params.organizationId}
        currentPath={location && location.pathname}
        header={topNav}
      >
        {main}
      </ShoreShell>
    );
  }
}

TexterDashboard.propTypes = {
  router: PropTypes.object,
  params: PropTypes.object,
  children: PropTypes.object,
  location: PropTypes.object,
  main: PropTypes.element,
  topNav: PropTypes.element,
  fullScreen: PropTypes.object
};

export default withRouter(TexterDashboard);
