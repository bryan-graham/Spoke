import React, { useState } from "react";
import PropTypes from "prop-types";
import Card from "@material-ui/core/Card";
import Collapse from "@material-ui/core/Collapse";
import { makeStyles } from "@material-ui/core/styles";
import { IconAlertTriangle, IconChevronDown } from "@tabler/icons-react";
import { v, fonts, layout } from "../styles/shore-tokens";

// Shore's "collapsed detail" pattern (docs/shore-design-guide.md): a bordered
// card whose header shows an icon, the title, an optional summary badge and
// a chevron; the content opens below. Used for the campaign editor's
// sections, Message Review's filters and actions, and campaign stats.
//
// Controlled (expanded + onToggle) or, without `expanded`, it keeps its own
// open state, starting open unless `startCollapsed`. colorTheme="warning"
// (campaign stats' Sending Errors) shows a warning icon.

const useStyles = makeStyles({
  card: { marginTop: 12, overflow: "hidden" },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "14px 20px",
    border: "none",
    background: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    boxSizing: "border-box"
  },
  toggle: {
    cursor: "pointer",
    "&:hover": { backgroundColor: v("navHover") },
    "&:focus-visible": {
      outline: `2px solid ${v("primary")}`,
      outlineOffset: -2
    }
  },
  icon: { display: "flex", color: v("dimmed") },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.heading,
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: "-0.01em",
    color: v("text")
  },
  chevron: {
    display: "flex",
    color: v("dimmed"),
    transition: "transform 150ms ease"
  },
  open: { transform: "rotate(180deg)" },
  body: {
    padding: "8px 20px 20px",
    borderTop: `1px solid ${v("panelBorder")}`
  }
});

// A small pill for the header's summary: tone is done | todo | info | neutral.
const TONES = {
  done: ["doneText", "doneBg"],
  todo: ["todoText", "todoBg"],
  info: ["infoText", "infoBg"],
  neutral: ["dimmed", "subtle"]
};

export function SummaryBadge({ tone, children }) {
  const [text, bg] = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        color: v(text),
        backgroundColor: v(bg)
      }}
    >
      {children}
    </span>
  );
}

SummaryBadge.propTypes = {
  tone: PropTypes.oneOf(["done", "todo", "info", "neutral"]),
  children: PropTypes.node
};

export default function CollapsibleCard({
  title,
  icon,
  badge,
  expanded,
  canToggle,
  onToggle,
  progress,
  footer,
  children,
  startCollapsed,
  colorTheme,
  ...rest
}) {
  const classes = useStyles();
  const controlled = expanded !== undefined;
  const [ownOpen, setOwnOpen] = useState(!startCollapsed);
  const open = Boolean((controlled ? expanded : ownOpen) && canToggle);
  const handleToggle = controlled ? onToggle : () => setOwnOpen(!ownOpen);
  const shownIcon =
    icon ||
    (colorTheme === "warning" ? (
      <span style={{ display: "flex", color: v("todoText") }}>
        <IconAlertTriangle size={20} stroke={layout.iconStroke} />
      </span>
    ) : null);
  const headerContent = (
    <>
      {shownIcon ? <span className={classes.icon}>{shownIcon}</span> : null}
      <span className={classes.title}>{title}</span>
      {badge}
      {canToggle ? (
        <span className={`${classes.chevron} ${open ? classes.open : ""}`}>
          <IconChevronDown size={18} stroke={layout.iconStroke} />
        </span>
      ) : null}
    </>
  );
  return (
    <Card className={classes.card} {...rest}>
      {canToggle ? (
        <button
          type="button"
          className={`${classes.header} ${classes.toggle}`}
          aria-expanded={open}
          onClick={handleToggle}
        >
          {headerContent}
        </button>
      ) : (
        <div className={classes.header}>{headerContent}</div>
      )}
      {progress}
      <Collapse in={open} timeout="auto" unmountOnExit>
        <div className={classes.body}>{children}</div>
      </Collapse>
      {footer}
    </Card>
  );
}

CollapsibleCard.propTypes = {
  title: PropTypes.node.isRequired,
  icon: PropTypes.node,
  badge: PropTypes.node,
  expanded: PropTypes.bool,
  canToggle: PropTypes.bool,
  onToggle: PropTypes.func,
  progress: PropTypes.node,
  footer: PropTypes.node,
  children: PropTypes.node,
  startCollapsed: PropTypes.bool,
  colorTheme: PropTypes.string
};

CollapsibleCard.defaultProps = { canToggle: true };
