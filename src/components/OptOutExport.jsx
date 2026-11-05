import PropTypes from "prop-types";
import React, { useState } from "react";
import { useQuery } from "@apollo/client";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import { makeStyles } from "@material-ui/core/styles";
import { IconDownload } from "@tabler/icons-react";
import useShoreMenu from "./ShoreShell/useShoreMenu";
import { SHELL_QUERY } from "./ShoreShell/ShoreShell";
import { hasRoleAtLeast } from "../lib/permissions";
import { v, fonts, layout } from "../styles/shore-tokens";

// Download the organization's opt-outs between two dates as a CSV (Settings,
// Opt-outs). For admins, and only when Spoke isn't showing Shore's menu:
// with Shore, opt-outs are managed in Shore.

export const EXPORT_PATH = "/opt-out-export";

const pad = n => String(n).padStart(2, "0");
// A date input's value ("2026-11-04") for a Date, in local time.
export const inputDate = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// The local start of the first day, and the local start of the day after
// the last, so the end date is included. null if the dates don't work.
export function exportRange(startDay, endDay) {
  const parse = day => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || "");
    return match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : null;
  };
  const start = parse(startDay);
  const last = parse(endDay);
  if (!start || !last) {
    return { error: "Choose a start and end date." };
  }
  if (last < start) {
    return { error: "The end date must be on or after the start date." };
  }
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
  return { start, end };
}

export const exportUrl = (organizationId, startDay, endDay, range) =>
  `${EXPORT_PATH}/${encodeURIComponent(organizationId)}?${new URLSearchParams({
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    label: `${startDay}-to-${endDay}`
  }).toString()}`;

const useStyles = makeStyles({
  box: {
    marginTop: 20,
    paddingTop: 20,
    borderTop: `1px solid ${v("panelBorder")}`
  },
  title: {
    fontFamily: fonts.heading,
    fontWeight: 700,
    fontSize: 15,
    color: v("text")
  },
  lead: {
    color: v("dimmed"),
    fontSize: 14,
    lineHeight: 1.5,
    margin: "4px 0 16px"
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12
  },
  date: { width: 180 },
  error: { color: v("countText"), fontSize: 13, marginTop: 10 }
});

export default function OptOutExport({ organizationId, today }) {
  const classes = useStyles();
  const { menu: shoreMenu, loaded } = useShoreMenu(organizationId);
  const { data } = useQuery(SHELL_QUERY, {
    variables: { organizationId },
    skip: !organizationId
  });
  const now = today || new Date();
  const monthAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 30
  );
  const [startDay, setStartDay] = useState(inputDate(monthAgo));
  const [endDay, setEndDay] = useState(inputDate(now));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const roles = (data && data.currentUser && data.currentUser.roles) || [];
  // Each role checked on its own: getHighestRole's sort depends on the
  // order the roles arrive in.
  const isAdmin = roles.some(role => hasRoleAtLeast(role, "ADMIN"));
  if (!loaded || shoreMenu || !isAdmin) {
    return null;
  }

  const download = async () => {
    const range = exportRange(startDay, endDay);
    if (range.error) {
      setError(range.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        exportUrl(organizationId, startDay, endDay, range),
        { credentials: "same-origin", cache: "no-store" }
      );
      if (!res.ok) {
        setError(
          (await res.text()) || "The export failed. Try again in a moment."
        );
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `opt-outs-${startDay}-to-${endDay}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (err) {
      setError("The export failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={classes.box} data-test="optOutExport">
      <div className={classes.title}>Export opt-outs</div>
      <div className={classes.lead}>
        A CSV of everyone opted out between these dates (both included): when,
        their number, external ID and name, the campaign, the texter, the
        reason, and how the opt-out was matched to the contact.
      </div>
      <div className={classes.row}>
        <TextField
          className={classes.date}
          label="From"
          type="date"
          variant="outlined"
          size="small"
          value={startDay}
          onChange={event => setStartDay(event.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ max: endDay || undefined, "data-test": "exportFrom" }}
        />
        <TextField
          className={classes.date}
          label="To"
          type="date"
          variant="outlined"
          size="small"
          value={endDay}
          onChange={event => setEndDay(event.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: startDay || undefined, "data-test": "exportTo" }}
        />
        <Button
          variant="outlined"
          onClick={download}
          disabled={busy}
          startIcon={<IconDownload size={18} stroke={layout.iconStroke} />}
        >
          {busy ? "Preparing…" : "Download CSV"}
        </Button>
      </div>
      {error ? (
        <div className={classes.error} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

OptOutExport.propTypes = {
  organizationId: PropTypes.string,
  today: PropTypes.instanceOf(Date)
};
