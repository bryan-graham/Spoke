import type from "prop-types";
import React from "react";
import { StyleSheet, css } from "aphrodite";

import Button from "@material-ui/core/Button";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Autocomplete from "@material-ui/lab/Autocomplete";
import TextField from "@material-ui/core/TextField";

const styles = StyleSheet.create({
  form: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start"
  },
  hint: {
    color: "#666",
    fontSize: "0.85em",
    margin: "4px 0 12px"
  },
  error: {
    color: "#b00020",
    margin: "8px 0"
  }
});

export const ERROR_MESSAGES = {
  not_configured:
    "Shore isn't configured for this organization. Ask your Spoke administrator.",
  shore_unreachable: "Couldn't reach Shore. Try again in a minute.",
  shore_rejected:
    "Shore rejected the request. Check the Shore URL, campaign and key.",
  shore_bad_response: "Shore sent a response Spoke didn't understand.",
  segment_required: "Choose a segment before saving.",
  segment_not_found: "That segment no longer exists in Shore.",
  load_expired: "The load expired before it finished. Save again to retry.",
  load_error: "The load failed. Save again to retry."
};

export const errorMessage = code =>
  ERROR_MESSAGES[code] || `The load failed (${code}).`;

const parseJson = value => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
};

const countLabel = count =>
  typeof count === "number" ? `${count.toLocaleString()} textable` : "";

export class CampaignContactsForm extends React.Component {
  constructor(props) {
    super(props);
    const reference = props.lastResult && parseJson(props.lastResult.reference);
    this.state = {
      selected:
        reference && reference.segmentId
          ? { id: reference.segmentId, name: reference.segmentName }
          : null
    };
  }

  choiceData() {
    return parseJson(this.props.clientChoiceData) || {};
  }

  handleChange = (event, segment) => {
    this.setState({ selected: segment || null });
    if (segment) {
      this.props.onChange(
        JSON.stringify({ segmentId: segment.id, segmentName: segment.name })
      );
    } else {
      this.props.onChange(undefined);
    }
  };

  renderPicker() {
    const data = this.choiceData();
    if (data.error) {
      return (
        <div className={css(styles.error)}>{errorMessage(data.error)}</div>
      );
    }
    const segments = data.segments || [];
    const fetchedAt = data.fetchedAt ? new Date(data.fetchedAt) : null;
    return (
      <div>
        <Autocomplete
          options={segments}
          value={
            (this.state.selected &&
              segments.find(s => s.id === this.state.selected.id)) ||
            null
          }
          getOptionLabel={option => option.name || ""}
          getOptionSelected={(option, value) => option.id === value.id}
          renderOption={option => (
            <div>
              <div>
                {option.name}
                {option.textableCount !== null &&
                  ` (${countLabel(option.textableCount)})`}
              </div>
              {option.description && (
                <div className={css(styles.hint)}>{option.description}</div>
              )}
            </div>
          )}
          onChange={this.handleChange}
          renderInput={params => (
            <TextField
              {...params}
              style={{ width: 400 }}
              label="Shore segment"
            />
          )}
        />
        <div className={css(styles.hint)}>
          {segments.length === 0
            ? "No segments in Shore for this campaign yet."
            : "Counts are how many people Shore can text right now; the load may differ slightly."}
          {fetchedAt && ` Counts as of ${fetchedAt.toLocaleTimeString()}.`}
        </div>
      </div>
    );
  }

  renderLastResult() {
    const { lastResult, icons } = this.props;
    if (!lastResult) {
      return null;
    }
    const reference = parseJson(lastResult.reference) || {};
    const result = parseJson(lastResult.result) || {};
    return (
      <List
        subheader={<ListSubheader component="div">Last import</ListSubheader>}
      >
        {reference.segmentName && (
          <ListItem key="segment">
            <ListItemIcon>{icons && icons.info}</ListItemIcon>
            <ListItemText primary={`Segment: ${reference.segmentName}`} />
          </ListItem>
        )}
        {(result.errors || []).map(code => (
          <ListItem key={`error-${code}`}>
            <ListItemIcon>{icons && icons.error}</ListItemIcon>
            <ListItemText primary={errorMessage(code)} />
          </ListItem>
        ))}
        {result.invalidCellCount ? (
          <ListItem key="invalid">
            <ListItemIcon>{icons && icons.warning}</ListItemIcon>
            <ListItemText
              primary={`${result.invalidCellCount} contacts with an invalid cell number skipped`}
            />
          </ListItem>
        ) : null}
      </List>
    );
  }

  render() {
    return (
      <div className={css(styles.form)}>
        {this.renderPicker()}
        {this.renderLastResult()}
        <Button
          color="primary"
          disabled={this.props.saveDisabled}
          onClick={() => this.props.onSubmit()}
        >
          {this.props.saveLabel}
        </Button>
      </div>
    );
  }
}

CampaignContactsForm.propTypes = {
  onChange: type.func,
  onSubmit: type.func,
  campaignIsStarted: type.bool,
  icons: type.object,
  saveDisabled: type.bool,
  saveLabel: type.string,
  clientChoiceData: type.string,
  jobResultMessage: type.string,
  lastResult: type.object
};
