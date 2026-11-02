import PropTypes from "prop-types";
import React from "react";

import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { IconArrowLeft } from "@tabler/icons-react";

import { Link as RouterLink } from "react-router";
import withMuiTheme from "./../containers/hoc/withMuiTheme";
import { layout, v } from "../styles/shore-tokens";

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
  description: { color: v("dimmed"), fontSize: 16, marginTop: 6 },
  back: { marginLeft: -8 }
}));

export function TopNavBase(props) {
  const classes = useStyles();
  const { backToURL, title, description, actions } = props;
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
      </div>
      {actions ? <div>{actions}</div> : null}
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
