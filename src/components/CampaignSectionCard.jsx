import React from "react";
import PropTypes from "prop-types";
import CircularProgress from "@material-ui/core/CircularProgress";
import LinearProgress from "@material-ui/core/LinearProgress";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import { v, layout } from "../styles/shore-tokens";
import CollapsibleCard, { SummaryBadge } from "./CollapsibleCard";

// One section of the campaign editor: a CollapsibleCard whose icon and badge
// say whether the section is done, still to do, or saving.

const STATUS = {
  done: { label: "Done", tone: "done" },
  todo: { label: "To do", tone: "todo" },
  saving: { label: "Saving", tone: "info" }
};

export default function CampaignSectionCard({
  status,
  savePercent,
  canToggle,
  ...rest
}) {
  const s = STATUS[status] || STATUS.todo;
  // Icons draw in currentColor, so the scheme's colour comes from a wrapper
  // (SVG attributes can't take CSS variables).
  const icon =
    status === "saving" ? (
      <CircularProgress size={18} />
    ) : status === "done" ? (
      <span style={{ display: "flex", color: v("doneText") }}>
        <IconCircleCheck size={20} stroke={layout.iconStroke} />
      </span>
    ) : (
      <span style={{ display: "flex", color: v("todoText") }}>
        <IconAlertTriangle size={20} stroke={layout.iconStroke} />
      </span>
    );
  return (
    <CollapsibleCard
      icon={icon}
      badge={
        <SummaryBadge tone={s.tone}>
          {status === "saving" && typeof savePercent === "number"
            ? `${s.label} ${savePercent}%`
            : s.label}
        </SummaryBadge>
      }
      canToggle={Boolean(canToggle)}
      progress={
        status === "saving" ? (
          <LinearProgress
            variant={
              typeof savePercent === "number" ? "determinate" : "indeterminate"
            }
            value={savePercent || 0}
          />
        ) : null
      }
      {...rest}
    />
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
