import React, { useContext } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";

// Lets a page put its main actions (and a one-line description) into the
// page header, as Shore does (docs/shore-design-guide.md, "Page header"):
// title and description on the left, the page's main actions on the right.
//
//   <PageActions>
//     <Button variant="contained" color="primary" ...>New campaign</Button>
//   </PageActions>
//
// The children are rendered into the header with a portal, so they stay part
// of the page: its state and handlers work as before. Outside the Shore shell
// (no header), they render where they're placed.

export const PageHeaderContext = React.createContext({
  actionsNode: null,
  setActionsNode: null,
  descriptionNode: null,
  setDescriptionNode: null
});

function HeaderPortal({ node, children }) {
  if (node) {
    return ReactDOM.createPortal(children, node);
  }
  return <>{children}</>;
}

HeaderPortal.propTypes = { node: PropTypes.object, children: PropTypes.node };

export function PageActions({ children }) {
  const { actionsNode, setActionsNode } = useContext(PageHeaderContext);
  // Inside the shell but before the header's slot has mounted: wait a render
  // rather than flashing the actions in the page body.
  if (setActionsNode && !actionsNode) {
    return null;
  }
  return <HeaderPortal node={actionsNode}>{children}</HeaderPortal>;
}

PageActions.propTypes = { children: PropTypes.node };

export function PageDescription({ children }) {
  const { descriptionNode, setDescriptionNode } = useContext(PageHeaderContext);
  if (setDescriptionNode && !descriptionNode) {
    return null;
  }
  return <HeaderPortal node={descriptionNode}>{children}</HeaderPortal>;
}

PageDescription.propTypes = { children: PropTypes.node };
