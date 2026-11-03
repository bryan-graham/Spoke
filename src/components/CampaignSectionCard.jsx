import React from "react";
import PropTypes from "prop-types";
import Card from "@material-ui/core/Card";
import Collapse from "@material-ui/core/Collapse";
import CircularProgress from "@material-ui/core/CircularProgress";
import LinearProgress from "@material-ui/core/LinearProgress";
import { makeStyles } from "@material-ui/core/styles";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCircleCheck
} from "@tabler/icons-react";
import { v, fonts, layout } from "../styles/shore-tokens";

// One section of the campaign editor, in Shore's "collapsed detail" style
// (docs/shore-design-guide.md): a bordered card whose header shows a status
// icon, the title, a summary badge and a chevron; the form opens below.

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
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.heading,
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: "-0.01em",
    color: v("text")
  },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 999,
    whiteSpace: "nowrap"
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

const STATUS = {
  done: { label: "Done", text: "doneText", bg: "doneBg" },
  todo: { label: "To do", text: "todoText", bg: "todoBg" },
  saving: { label: "Saving", text: "infoText", bg: "infoBg" }
};

export default function CampaignSectionCard({
  title,
  status,
  savePercent,
  expanded,
  canToggle,
  onToggle,
  footer,
  children,
  ...rest
}) {
  const classes = useStyles();
  const s = STATUS[status] || STATUS.todo;
  const icon =
    status === "saving" ? (
      <CircularProgress size={18} />
    ) : status === "done" ? (
      // Icons draw in currentColor, so the scheme's colour comes from a
      // wrapper (SVG attributes can't take CSS variables).
      <span style={{ display: "flex", color: v("doneText") }}>
        <IconCircleCheck size={20} stroke={layout.iconStroke} />
      </span>
    ) : (
      <span style={{ display: "flex", color: v("todoText") }}>
        <IconAlertTriangle size={20} stroke={layout.iconStroke} />
      </span>
    );
  const open = Boolean(expanded && canToggle);
  const headerContent = (
    <>
      {icon}
      <span className={classes.title}>{title}</span>
      <span
        className={classes.badge}
        style={{ color: v(s.text), backgroundColor: v(s.bg) }}
      >
        {status === "saving" && typeof savePercent === "number"
          ? `${s.label} ${savePercent}%`
          : s.label}
      </span>
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
          onClick={onToggle}
        >
          {headerContent}
        </button>
      ) : (
        <div className={classes.header}>{headerContent}</div>
      )}
      {status === "saving" ? (
        <LinearProgress
          variant={
            typeof savePercent === "number" ? "determinate" : "indeterminate"
          }
          value={savePercent || 0}
        />
      ) : null}
      <Collapse in={open} timeout="auto" unmountOnExit>
        <div className={classes.body}>{children}</div>
      </Collapse>
      {footer}
    </Card>
  );
}

CampaignSectionCard.propTypes = {
  title: PropTypes.string.isRequired,
  status: PropTypes.oneOf(["done", "todo", "saving"]).isRequired,
  savePercent: PropTypes.number,
  expanded: PropTypes.bool,
  canToggle: PropTypes.bool,
  onToggle: PropTypes.func,
  footer: PropTypes.node,
  children: PropTypes.node
};
