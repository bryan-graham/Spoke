import PropTypes from "prop-types";
import { IconMessage } from "@tabler/icons-react";
import { v, fonts } from "../styles/shore-tokens";
import React, { Component } from "react";
import { StyleSheet, css } from "aphrodite";

import Button from "@material-ui/core/Button";
import Badge from "@material-ui/core/Badge";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";

import { withRouter } from "react-router";
import withMuiTheme from "../containers/hoc/withMuiTheme";
import { dataTest } from "../lib/attributes";
import {
  getSideboxes,
  renderSummary
} from "../extensions/texter-sideboxes/components";
import theme from "../styles/mui-theme";

const styles = StyleSheet.create({
  container: {
    margin: `${theme.spacing(2)}px 0`
  },
  image: {
    height: 100
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2)
  }
});

export class AssignmentSummaryBase extends Component {
  state = {
    badTimezoneTooltipOpen: false
  };

  goToTodos(contactsFilter, assignmentId) {
    const { organizationId, router, todoLink } = this.props;
    if (todoLink) {
      return todoLink(contactsFilter, assignmentId, router);
    }
    if (contactsFilter) {
      router.push(
        `/app/${organizationId}/todos/${assignmentId}/${contactsFilter}`
      );
    }
  }

  renderBadgedButton({
    dataTestText,
    assignment,
    title,
    count,
    disabled,
    contactsFilter,
    hideIfZero,
    style,
    hideBadge,
    color,
    primary
  }) {
    if (count === 0 && hideIfZero) {
      return "";
    }
    if (count === 0 || hideBadge) {
      return (
        <Button
          {...dataTest(dataTestText)}
          disabled={disabled}
          variant={primary && !disabled ? "contained" : "outlined"}
          color={primary && !disabled ? "primary" : "default"}
          onClick={() => this.goToTodos(contactsFilter, assignment.id)}
        >
          {title}
        </Button>
      );
    } else {
      return (
        <Badge
          key={title}
          badgeContent={count || ""}
          color={disabled ? "primary" : color}
        >
          <Button
            {...dataTest(dataTestText)}
            disabled={disabled}
            onClick={() => this.goToTodos(contactsFilter, assignment.id)}
            variant={primary && !disabled ? "contained" : "outlined"}
            color={primary && !disabled ? "primary" : "default"}
          >
            {title}
          </Button>
        </Badge>
      );
    }
  }

  render() {
    const { assignment, texter } = this.props;
    const {
      campaign,
      unmessagedCount,
      unrepliedCount,
      badTimezoneCount,
      pastMessagesCount,
      skippedMessagesCount,
      feedback
    } = assignment;
    const {
      id: campaignId,
      title,
      description,
      primaryColor,
      logoImageUrl,
      introHtml,
      texterUIConfig
    } = campaign;
    const settingsData = JSON.parse(
      (texterUIConfig && texterUIConfig.options) || "{}"
    );
    const sideboxProps = { assignment, campaign, texter, settingsData };
    const enabledSideboxes = getSideboxes(sideboxProps, "TexterTodoList");
    // if there's a sidebox marked popup, then we will only show that sidebox and little else
    const hasPopupSidebox = Boolean(enabledSideboxes.popups.length);
    const sideboxList = enabledSideboxes
      .filter(sb =>
        hasPopupSidebox ? sb.name === enabledSideboxes.popups[0] : true
      )
      .map(sb => renderSummary(sb, settingsData, this, sideboxProps));

    let cardTitleTextColor = this.props.muiTheme.palette.getContrastText(
      this.props.muiTheme.palette.background.default
    );
    if (primaryColor) {
      try {
        cardTitleTextColor = this.props.muiTheme.palette.getContrastText(
          primaryColor
        );
      } catch (e) {}
    }

    // NOTE: we bring back archived campaigns if they have feedback
    // but want to get rid of them once feedback is acknowledged
    if (campaign.isArchived && !hasPopupSidebox) return null;
    const campaignAllowBulkSend =
      texterUIConfig &&
      texterUIConfig.sideboxChoices &&
      texterUIConfig.sideboxChoices.includes("per-campaign-bulk-send")
        ? settingsData["per-campaign-bulk-send"]
        : true;
    return (
      <div
        className={css(styles.container)}
        {...dataTest(`assignmentSummary-${campaignId}`)}
      >
        <Card>
          {/* Shore's card title: the campaign's logo, or a tile in its colour,
              then the title and a dimmed description. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "20px 20px 4px"
            }}
          >
            {logoImageUrl ? (
              <img
                src={logoImageUrl}
                alt=""
                style={{ height: 40, maxWidth: 120, objectFit: "contain" }}
              />
            ) : (
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: primaryColor || v("subActiveBg"),
                  color: primaryColor ? cardTitleTextColor : v("subActiveText")
                }}
              >
                <IconMessage size={16} stroke={1.7} />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: fonts.heading,
                  fontWeight: 700,
                  fontSize: 17,
                  color: v("text")
                }}
              >
                {title}
              </div>
              {description ? (
                <div style={{ color: v("dimmed"), marginTop: 2 }}>
                  {description}
                </div>
              ) : null}
            </div>
          </div>
          <CardContent>
            {introHtml && (
              <div style={{ margin: "20px" }}>
                <div dangerouslySetInnerHTML={{ __html: introHtml }} />
              </div>
            )}
            {(hasPopupSidebox && sideboxList) || null}

            <div className={css(styles.buttonRow)}>
              {(this.props.assignment.campaign.organization.allowSendAll &&
                campaignAllowBulkSend) ||
              hasPopupSidebox
                ? null
                : this.renderBadgedButton({
                    dataTestText: "sendFirstTexts",
                    assignment,
                    title: "Send first texts",
                    count: unmessagedCount,
                    primary: true,
                    disabled: false,
                    contactsFilter: "text",
                    hideIfZero: true,
                    color: "error"
                  })}
              {hasPopupSidebox
                ? null
                : this.renderBadgedButton({
                    dataTestText: "Respond",
                    assignment,
                    title: "Respond",
                    count: unrepliedCount,
                    primary: false,
                    disabled: false,
                    contactsFilter: "reply",
                    hideIfZero: true,
                    color: "error"
                  })}
              {this.renderBadgedButton({
                assignment,
                title: pastMessagesCount
                  ? `Past ${pastMessagesCount} Messages`
                  : `Past Messages`,
                count: pastMessagesCount,
                primary: false,
                disabled: false,
                contactsFilter: "stale",
                hideIfZero: true,
                color: "secondary",
                hideBadge: true
              })}
              {this.renderBadgedButton({
                assignment,
                title: skippedMessagesCount
                  ? `Skipped ${skippedMessagesCount} Messages`
                  : `Skipped Messages`,
                count: skippedMessagesCount,
                primary: false,
                disabled: false,
                contactsFilter: "skipped",
                hideIfZero: true,
                color: "secondary",
                hideBadge: true
              })}
              {this.props.assignment.campaign.organization.allowSendAll &&
              campaignAllowBulkSend &&
              !hasPopupSidebox
                ? this.renderBadgedButton({
                    assignment,
                    title: "Send messages",
                    primary: true,
                    disabled: false,
                    contactsFilter: "text",
                    count: 0,
                    hideIfZero: false,
                    color: "primary"
                  })
                : ""}
              {this.renderBadgedButton({
                assignment,
                title: "Send later (outside timezone)",
                count: badTimezoneCount,
                primary: false,
                disabled: true,
                contactsFilter: null,
                hideIfZero: true,
                color: "secondary"
              })}
            </div>

            {sideboxList.length && !hasPopupSidebox ? (
              <div>{sideboxList}</div>
            ) : null}

            {!sideboxList.length &&
              !unmessagedCount &&
              !unrepliedCount &&
              !pastMessagesCount &&
              !skippedMessagesCount &&
              !badTimezoneCount && (
                <div style={{ color: v("dimmed") }}>
                  Nothing to text here right now.
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    );
  }
}

AssignmentSummaryBase.propTypes = {
  organizationId: PropTypes.string,
  router: PropTypes.object,
  assignment: PropTypes.object,
  texter: PropTypes.object,
  refreshData: PropTypes.func,
  todoLink: PropTypes.func
};

export default withMuiTheme(withRouter(AssignmentSummaryBase));
