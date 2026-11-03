import PropTypes from "prop-types";
import React, { useContext } from "react";

import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { IconArrowLeft } from "@tabler/icons-react";

import { Link as RouterLink } from "react-router";
import withMuiTheme from "./../containers/hoc/withMuiTheme";
import { layout, v } from "../styles/shore-tokens";
import { PageHeaderContext } from "./ShoreShell/PageHeader";

// The page header inside the Shore shell's panel (docs/shore-design-guide.md,
// "Page header"): title on the left, optional back link, actions on the
// right. The account menu that used to sit here is in the sidebar now.

const useStyles = makeStyles(() => ({
  header: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24
  },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 30, lineHeight: 1.15 },
  description: {
    color: v("dimmed"),
    fontSize: 16,
    marginTop: 6,
    "&:empty": { display: "none" }
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    "&:empty": { display: "none" }
  },
  back: { marginLeft: -8 }
}));

export function TopNavBase(props) {
  const classes = useStyles();
  const { backToURL, title, description, actions } = props;
  // Pages add their main actions and a description with <PageActions> and
  // <PageDescription>; they land in these slots.
  const { setActionsNode, setDescriptionNode } = useContext(PageHeaderContext);
  return (
    <header className={classes.header}>
      {backToURL && (
        <RouterLink to={backToURL} aria-label="Back">
          <IconButton className={classes.back}>
            <IconArrowLeft size={22} stroke={layout.iconStroke} />
          </IconButton>
        </RouterLink>
      )}
      <div className={classes.titles}>
        <Typography variant="h1" component="h1" className={classes.title}>
          {title}
        </Typography>
        {description ? (
          <div className={classes.description}>{description}</div>
        ) : null}
        {setDescriptionNode ? (
          <div className={classes.description} ref={setDescriptionNode} />
        ) : null}
      </div>
      <div className={classes.actions}>
        {actions}
        {setActionsNode ? (
          <div className={classes.actions} ref={setActionsNode} />
        ) : null}
      </div>
    </header>
  );
}

TopNavBase.propTypes = {
  backToURL: PropTypes.string,
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  actions: PropTypes.node,
  orgId: PropTypes.string
};

export default withMuiTheme(TopNavBase);
