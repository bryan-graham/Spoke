import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router";
import { makeStyles } from "@material-ui/core/styles";
import { camelCase } from "lodash";
import { v, layout, palette } from "../../styles/shore-tokens";
import { iconFor } from "./icons";
import { dataTest } from "../../lib/attributes";

const useStyles = makeStyles({
  row: {
    // Matches Shore's nav rows (Mantine NavLink): 40px rows 4px apart,
    // 12px between icon and label.
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 40,
    marginBottom: 4,
    padding: "0 12px",
    borderRadius: layout.controlRadius,
    color: v("navText"),
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "none",
    cursor: "pointer",
    "&:hover": { backgroundColor: v("navHover") },
    "&:focus-visible": {
      outline: `2px solid ${palette.navy[5]}`,
      outlineOffset: 1
    }
  },
  sub: {
    marginLeft: 20,
    minHeight: 34,
    marginBottom: 2,
    gap: 10,
    fontSize: 13
  },
  active: {
    backgroundColor: v("navActiveBg"),
    color: v("navActiveText"),
    boxShadow: v("navActiveShadow"),
    "&:hover": { backgroundColor: v("navActiveHover") }
  },
  // A current sub-item (a Spoke page under Texting): the parent Texting row
  // is the solid "current" row, so the page itself takes a light tint.
  subActive: {
    backgroundColor: v("subActiveBg"),
    color: v("subActiveText"),
    fontWeight: 600,
    "&:hover": { backgroundColor: v("subActiveBg") }
  },
  label: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  count: {
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 10,
    backgroundColor: v("countBg"),
    color: v("countText"),
    fontSize: 11,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box"
  }
});

export default function NavItem({ item, sub, onNavigate }) {
  const classes = useStyles();
  const Icon = iconFor(item.icon);
  const className = [
    classes.row,
    sub ? classes.sub : "",
    item.active ? (sub ? classes.subActive : classes.active) : ""
  ].join(" ");
  const content = (
    <>
      <Icon size={sub ? 16 : 18} stroke={layout.iconStroke} aria-hidden />
      <span className={classes.label}>{item.label}</span>
      {item.count ? (
        <span
          className={classes.count}
          aria-label={`${item.count} need attention`}
        >
          {item.count}
        </span>
      ) : null}
    </>
  );
  const common = {
    className,
    "aria-current": item.active ? "page" : undefined,
    onClick: onNavigate,
    ...dataTest(item.dataTest || camelCase(`nav ${item.key}`))
  };
  if (item.to) {
    return (
      <Link to={item.to} {...common}>
        {content}
      </Link>
    );
  }
  return (
    <a
      href={item.href}
      target={item.newTab ? "_blank" : undefined}
      rel={item.newTab ? "noopener noreferrer" : undefined}
      {...common}
    >
      {content}
    </a>
  );
}

NavItem.propTypes = {
  item: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.string,
    to: PropTypes.string,
    href: PropTypes.string,
    newTab: PropTypes.bool,
    count: PropTypes.number,
    active: PropTypes.bool,
    dataTest: PropTypes.string
  }).isRequired,
  sub: PropTypes.bool,
  onNavigate: PropTypes.func
};
