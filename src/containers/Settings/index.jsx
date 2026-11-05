/* eslint no-console: 0 */
import PropTypes from "prop-types";
import React from "react";
import { gql } from "@apollo/client";
import Form from "react-formal";
import moment from "moment";
import * as yup from "yup";
import { StyleSheet, css } from "aphrodite";

import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Button from "@material-ui/core/Button";
import {
  IconAdjustments,
  IconBan,
  IconClock,
  IconLayoutSidebar,
  IconMessageCog,
  IconPalette,
  IconPlugConnected,
  IconTool
} from "@tabler/icons-react";
import CollapsibleCard, {
  SummaryBadge
} from "../../components/CollapsibleCard";
import { PageDescription } from "../../components/ShoreShell/PageHeader";
import OrganizationLogoSettings from "../../components/OrganizationLogoSettings";
import OptOutExport from "../../components/OptOutExport";
import { v, fonts, layout } from "../../styles/shore-tokens";
import loadData from "../hoc/load-data";
import withSetTheme from "../hoc/withSetTheme";
import GSSubmitButton from "../../components/forms/GSSubmitButton";
import GSForm from "../../components/forms/GSForm";
import CampaignTexterUIForm from "../../components/CampaignTexterUIForm";
import OrganizationFeatureSettings from "../../components/OrganizationFeatureSettings";
import { getServiceVendorComponent } from "../../extensions/service-vendors/components";
import { getServiceManagerComponent } from "../../extensions/service-managers/components";
import GSTextField from "../../components/forms/GSTextField";
import ThemeEditor from "./themeEditor";

// Shore's page pattern (docs/shore-design-guide.md): a description under the
// page title, then one card per area, each with an icon, a title and a
// summary badge; the advanced areas start collapsed.
const styles = StyleSheet.create({
  section: {
    margin: "10px 0"
  },
  sectionLabel: {
    opacity: 0.8,
    marginRight: 5
  },
  textingHoursSpan: {
    fontWeight: 600
  },
  dialogActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16
  },
  cardHeader: {
    cursor: "pointer"
  },
  lead: {
    color: v("dimmed"),
    fontSize: 14,
    lineHeight: 1.5,
    margin: "4px 0 16px"
  },
  subheading: {
    fontFamily: fonts.heading,
    fontWeight: 700,
    fontSize: 15,
    color: v("text"),
    margin: "20px 0 4px"
  },
  firstSubheading: {
    marginTop: 4
  },
  row: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12
  },
  subCard: {
    border: `1px solid ${v("panelBorder")}`,
    borderRadius: layout.controlRadius,
    padding: "12px 16px",
    marginTop: 12
  },
  subCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    fontWeight: 600
  },
  formActions: {
    marginTop: 12
  }
});

const sectionIcon = Icon => <Icon size={20} stroke={layout.iconStroke} />;

const setUpBadge = fullyConfigured =>
  fullyConfigured === true ? (
    <SummaryBadge tone="done">Set up</SummaryBadge>
  ) : fullyConfigured === false ? (
    <SummaryBadge tone="todo">Needs setup</SummaryBadge>
  ) : null;

const formatTextingHours = hour => moment(hour, "H").format("h a");
class Settings extends React.Component {
  state = {
    formIsSubmitting: false
  };

  inlineStyles = {
    dialogButton: {
      display: "inline-block"
    },
    shadeBox: {
      backgroundColor: this.props.muiTheme.palette.action.hover
    },
    cardHeader: {
      cursor: "pointer"
    },
    errorBox: {
      backgroundColor: this.props.muiTheme.palette.action.hover,
      color: this.props.muiTheme.palette,
      fontWeight: "bolder"
    }
  };

  handleSubmitTextingHoursForm = async ({
    textingHoursStart,
    textingHoursEnd
  }) => {
    await this.props.mutations.updateTextingHours(
      textingHoursStart,
      textingHoursEnd
    );
    this.handleCloseTextingHoursDialog();
  };

  handleOpenTextingHoursDialog = () =>
    this.setState({ textingHoursDialogOpen: true });

  handleCloseTextingHoursDialog = () =>
    this.setState({ textingHoursDialogOpen: false });

  renderTextingHoursForm() {
    const { organization } = this.props.data;
    const { textingHoursStart, textingHoursEnd } = organization;
    const formSchema = yup.object({
      textingHoursStart: yup.number().required(),
      textingHoursEnd: yup.number().required()
    });

    const hours = new Array(24).fill(0).map((_, i) => i);
    const hourChoices = hours.map(hour => ({
      value: hour,
      label: formatTextingHours(hour)
    }));

    return (
      <Dialog
        maxWidth="md"
        open={!!this.state.textingHoursDialogOpen}
        onClose={this.handleCloseTextingHoursDialog}
      >
        <DialogContent>
          <GSForm
            schema={formSchema}
            onSubmit={this.handleSubmitTextingHoursForm}
            defaultValue={{ textingHoursStart, textingHoursEnd }}
          >
            <div className={css(styles.subheading, styles.firstSubheading)}>
              Texting hours
            </div>
            <div className={css(styles.lead)}>
              Texters can send first messages only between these hours.
            </div>
            <Form.Field
              as={GSTextField}
              label="From"
              name="textingHoursStart"
              type="select"
              fullWidth
              choices={hourChoices}
            />
            <Form.Field
              as={GSTextField}
              label="Until"
              name="textingHoursEnd"
              type="select"
              fullWidth
              choices={hourChoices}
            />
            <div className={css(styles.dialogActions)}>
              <Button
                variant="outlined"
                onClick={this.handleCloseTextingHoursDialog}
              >
                Cancel
              </Button>
              <Form.Submit
                as={GSSubmitButton}
                style={this.inlineStyles.dialogButton}
                label="Save"
              />
            </div>
          </GSForm>
        </DialogContent>
      </Dialog>
    );
  }

  renderServiceManagers() {
    const {
      id: organizationId,
      serviceManagers
    } = this.props.data.organization;
    if (!serviceManagers.length) {
      return null;
    }
    const allFullyConfigured = serviceManagers
      .map(sm => sm.fullyConfigured !== false)
      .reduce((a, b) => a && b, true);
    return (
      <CollapsibleCard
        title="Service management"
        icon={sectionIcon(IconPlugConnected)}
        badge={setUpBadge(allFullyConfigured)}
      >
        {serviceManagers.map(sm => {
          const ServiceManagerComp = getServiceManagerComponent(
            sm.name,
            "OrgConfig"
          );
          const serviceManagerName = sm.name;
          return (
            <div key={sm.name} className={css(styles.subCard)}>
              <div className={css(styles.subCardHeader)}>
                <span style={{ flex: 1 }}>{sm.displayName}</span>
                {setUpBadge(sm.fullyConfigured)}
              </div>
              <ServiceManagerComp
                serviceManagerInfo={sm}
                organizationId={organizationId}
                inlineStyles={this.inlineStyles}
                styles={styles}
                saveLabel={this.props.saveLabel}
                onSubmit={updateData =>
                  this.props.mutations.updateServiceManager(
                    serviceManagerName,
                    updateData
                  )
                }
              />
            </div>
          );
        })}
      </CollapsibleCard>
    );
  }

  renderServiceVendorConfig() {
    const { id: organizationId, serviceVendor } = this.props.data.organization;
    if (!serviceVendor) {
      return null;
    }

    const { name, supportsOrgConfig, config } = serviceVendor;
    if (!supportsOrgConfig) {
      return null;
    }
    const component = getServiceVendorComponent(name);
    const ConfigServiceVendor = component.OrgConfig;
    if (!ConfigServiceVendor) {
      return null;
    }

    return (
      <CollapsibleCard
        title={`${name.toUpperCase().charAt(0) + name.slice(1)} settings`}
        icon={sectionIcon(IconMessageCog)}
        badge={setUpBadge(Boolean(this.state.serviceVendorAllSet))}
      >
        <ConfigServiceVendor
          organizationId={organizationId}
          config={config}
          inlineStyles={this.inlineStyles}
          styles={styles}
          saveLabel={this.props.saveLabel}
          onSubmit={newConfig => {
            return this.props.mutations.updateServiceVendorConfig(newConfig);
          }}
          onAllSetChanged={allSet => {
            this.setState({ serviceVendorAllSet: allSet });
          }}
          requestRefetch={async () => {
            return this.props.data.refetch();
          }}
        />
      </CollapsibleCard>
    );
  }

  renderBranding() {
    const { id: organizationId } = this.props.data.organization;
    return (
      <div>
        <PageDescription>
          How this organization looks in Spoke: its logo and colours.
        </PageDescription>
        <CollapsibleCard title="Branding" icon={sectionIcon(IconPalette)}>
          <div className={css(styles.subheading, styles.firstSubheading)}>
            Logo
          </div>
          <div className={css(styles.lead)}>
            Shown at the top of the sidebar, in light and dark mode.
          </div>
          <OrganizationLogoSettings organizationId={organizationId} />
          <div className={css(styles.subheading)}>Colours</div>
          <div className={css(styles.lead)}>
            Buttons, links and highlights. Backgrounds and text always follow
            light or dark mode, so every page stays readable.
          </div>
          <ThemeEditor organizationId={organizationId} />
        </CollapsibleCard>
      </div>
    );
  }

  renderConnections() {
    const managers = this.renderServiceManagers();
    const vendor = this.renderServiceVendorConfig();
    return (
      <div>
        <PageDescription>
          The services Spoke uses to send texts and sync data for this
          organization.
        </PageDescription>
        {managers}
        {vendor}
        {!managers && !vendor ? (
          <div className={css(styles.lead)}>
            Nothing to set up here. Connections appear when your Spoke install
            turns on a service that's configured per organization.
          </div>
        ) : null}
      </div>
    );
  }

  render() {
    // One Settings tab at a time: General, Branding or Connections.
    if (this.props.section === "branding") {
      return this.renderBranding();
    }
    if (this.props.section === "connections") {
      return this.renderConnections();
    }
    const { organization } = this.props.data;
    const { optOutMessage, id: organizationId } = organization;
    const formSchema = yup.object({
      optOutMessage: yup.string().required()
    });

    const hoursSummary = organization.textingHoursEnforced
      ? `${formatTextingHours(
          organization.textingHoursStart
        )} – ${formatTextingHours(organization.textingHoursEnd)}`
      : "Off";

    return (
      <div>
        <PageDescription>
          How texting works for this organization: opt-outs, texting hours and
          defaults.
        </PageDescription>

        <CollapsibleCard title="Opt-outs" icon={sectionIcon(IconBan)}>
          <div className={css(styles.lead)}>
            Sent when a texter opts someone out, unless they choose to send
            nothing or write their own.
          </div>
          <GSForm
            schema={formSchema}
            onSubmit={this.props.mutations.updateOptOutMessage}
            defaultValue={{ optOutMessage }}
          >
            <Form.Field
              as={GSTextField}
              label="Default opt-out message"
              name="optOutMessage"
              variant="outlined"
              multiline
              fullWidth
            />
            <div className={css(styles.formActions)}>
              <Form.Submit
                as={GSSubmitButton}
                label={this.props.saveLabel || "Save opt-out message"}
              />
            </div>
          </GSForm>
          <OptOutExport organizationId={organizationId} />
        </CollapsibleCard>

        <CollapsibleCard
          title="Texting hours"
          icon={sectionIcon(IconClock)}
          badge={
            <SummaryBadge
              tone={organization.textingHoursEnforced ? "info" : "neutral"}
            >
              {hoursSummary}
            </SummaryBadge>
          }
        >
          <div className={css(styles.row)}>
            <FormControlLabel
              control={
                <Switch
                  color="primary"
                  checked={organization.textingHoursEnforced}
                  onChange={async (event, isToggled) =>
                    await this.props.mutations.updateTextingHoursEnforcement(
                      isToggled
                    )
                  }
                />
              }
              label="Only send first messages during texting hours"
            />
          </div>
          {organization.textingHoursEnforced ? (
            <div className={css(styles.row)} style={{ marginTop: 8 }}>
              <div style={{ flex: "1 1 280px" }}>
                <span className={css(styles.textingHoursSpan)}>
                  {formatTextingHours(organization.textingHoursStart)} to{" "}
                  {formatTextingHours(organization.textingHoursEnd)}
                </span>
                <span style={{ color: v("dimmed") }}>
                  {window.TZ
                    ? ` in your organization's time zone (${window.TZ}).`
                    : " in each contact's local time (12 pm – 6 pm Eastern when it's unknown)."}
                </span>
              </div>
              <Button
                variant="outlined"
                onClick={this.handleOpenTextingHoursDialog}
              >
                Change texting hours
              </Button>
            </div>
          ) : (
            <div className={css(styles.lead)}>
              Texters can send first messages at any time.
            </div>
          )}
        </CollapsibleCard>
        <div>{this.renderTextingHoursForm()}</div>

        {this.props.data.organization &&
        this.props.data.organization.texterUIConfig &&
        this.props.data.organization.texterUIConfig.sideboxChoices.length ? (
          <CollapsibleCard
            title="Texting screen defaults"
            icon={sectionIcon(IconLayoutSidebar)}
            startCollapsed
          >
            <div className={css(styles.lead)}>
              The side panels new campaigns start with. Each campaign can change
              them.
            </div>
            <CampaignTexterUIForm
              formValues={this.props.data.organization}
              organization={this.props.data.organization}
              onSubmit={async () => {
                const { texterUIConfig } = this.state;
                await this.props.mutations.editOrganization({
                  texterUIConfig
                });
                this.setState({ texterUIConfig: null });
              }}
              onChange={formValues => {
                this.setState(formValues);
              }}
              saveLabel="Save texting screen defaults"
              saveDisabled={!this.state.texterUIConfig}
            />
          </CollapsibleCard>
        ) : null}

        {this.props.data.organization && this.props.data.organization.settings && (
          <CollapsibleCard
            title="Overriding default settings"
            icon={sectionIcon(IconAdjustments)}
            startCollapsed
          >
            <OrganizationFeatureSettings
              formValues={this.props.data.organization}
              organization={this.props.data.organization}
              onSubmit={async () => {
                const { settings } = this.state;
                await this.props.mutations.editOrganization({
                  settings
                });
                this.setState({ settings: null });
              }}
              onChange={formValues => {
                this.setState(formValues);
              }}
              saveLabel="Save settings"
              saveDisabled={!this.state.settings}
            />
          </CollapsibleCard>
        )}

        {this.props.data.organization && this.props.params.adminPerms && (
          <CollapsibleCard
            title="Troubleshooting"
            icon={sectionIcon(IconTool)}
            startCollapsed
          >
            <div className={css(styles.lead)}>
              Only use these if you know what they do.
            </div>
            <Button
              variant="outlined"
              onClick={this.props.mutations.clearCachedOrgAndExtensionCaches}
            >
              Clear cached organization and extension caches
            </Button>
          </CollapsibleCard>
        )}
      </div>
    );
  }
}

Settings.propTypes = {
  data: PropTypes.object,
  params: PropTypes.object,
  mutations: PropTypes.object,
  saveLabel: PropTypes.string,
  section: PropTypes.oneOf(["general", "branding", "connections"])
};

const queries = {
  data: {
    query: gql`
      query adminGetCampaigns($organizationId: String!) {
        organization(id: $organizationId) {
          id
          name
          textingHoursEnforced
          textingHoursStart
          textingHoursEnd
          optOutMessage
          settings {
            messageHandlers
            actionHandlers
            featuresJSON
            unsetFeatures
          }
          texterUIConfig {
            options
            sideboxChoices
          }
          serviceVendor {
            id
            name
            supportsOrgConfig
            config
          }
          serviceManagers {
            id
            name
            displayName
            supportsOrgConfig
            data
            fullyConfigured
          }
        }
      }
    `,
    options: ownProps => ({
      variables: {
        organizationId: ownProps.params.organizationId
      },
      fetchPolicy: "network-only"
    })
  }
};

export const editOrganizationGql = gql`
  mutation editOrganization(
    $organizationId: String!
    $organizationChanges: OrganizationInput!
  ) {
    editOrganization(id: $organizationId, organization: $organizationChanges) {
      id
      settings {
        messageHandlers
        actionHandlers
        featuresJSON
        unsetFeatures
      }
      texterUIConfig {
        options
        sideboxChoices
      }
    }
  }
`;

export const updateServiceVendorConfigGql = gql`
  mutation updateServiceVendorConfig(
    $organizationId: String!
    $serviceName: String!
    $config: JSON!
  ) {
    updateServiceVendorConfig(
      organizationId: $organizationId
      serviceName: $serviceName
      config: $config
    ) {
      id
      config
    }
  }
`;

export const updateServiceManagerGql = gql`
  mutation updateServiceManager(
    $organizationId: String!
    $serviceManagerName: String!
    $updateData: JSON!
  ) {
    updateServiceManager(
      organizationId: $organizationId
      serviceManagerName: $serviceManagerName
      updateData: $updateData
    ) {
      id
      data
      fullyConfigured
    }
  }
`;

const mutations = {
  editOrganization: ownProps => organizationChanges => ({
    mutation: editOrganizationGql,
    variables: {
      organizationId: ownProps.params.organizationId,
      organizationChanges
    }
  }),
  updateTextingHours: ownProps => (textingHoursStart, textingHoursEnd) => ({
    mutation: gql`
      mutation updateTextingHours(
        $textingHoursStart: Int!
        $textingHoursEnd: Int!
        $organizationId: String!
      ) {
        updateTextingHours(
          textingHoursStart: $textingHoursStart
          textingHoursEnd: $textingHoursEnd
          organizationId: $organizationId
        ) {
          id
          textingHoursEnforced
          textingHoursStart
          textingHoursEnd
        }
      }
    `,
    variables: {
      organizationId: ownProps.params.organizationId,
      textingHoursStart,
      textingHoursEnd
    }
  }),
  updateTextingHoursEnforcement: ownProps => textingHoursEnforced => ({
    mutation: gql`
      mutation updateTextingHoursEnforcement(
        $textingHoursEnforced: Boolean!
        $organizationId: String!
      ) {
        updateTextingHoursEnforcement(
          textingHoursEnforced: $textingHoursEnforced
          organizationId: $organizationId
        ) {
          id
          textingHoursEnforced
          textingHoursStart
          textingHoursEnd
        }
      }
    `,
    variables: {
      organizationId: ownProps.params.organizationId,
      textingHoursEnforced
    }
  }),
  updateOptOutMessage: ownProps => ({ optOutMessage }) => ({
    mutation: gql`
      mutation updateOptOutMessage(
        $optOutMessage: String!
        $organizationId: String!
      ) {
        updateOptOutMessage(
          optOutMessage: $optOutMessage
          organizationId: $organizationId
        ) {
          id
          optOutMessage
        }
      }
    `,
    variables: {
      organizationId: ownProps.params.organizationId,
      optOutMessage
    }
  }),
  updateServiceVendorConfig: ownProps => newConfig => {
    return {
      mutation: updateServiceVendorConfigGql,
      variables: {
        organizationId: ownProps.params.organizationId,
        serviceName: ownProps.data.organization.serviceVendor.name,
        config: JSON.stringify(newConfig)
      }
    };
  },
  updateServiceManager: ownProps => (serviceManagerName, updateData) => {
    return {
      mutation: updateServiceManagerGql,
      variables: {
        serviceManagerName,
        updateData,
        organizationId: ownProps.params.organizationId
      }
    };
  },
  clearCachedOrgAndExtensionCaches: ownProps => () => ({
    mutation: gql`
      mutation clearCachedOrgAndExtensionCaches($organizationId: String!) {
        clearCachedOrgAndExtensionCaches(organizationId: $organizationId)
      }
    `,
    variables: {
      organizationId: ownProps.params.organizationId
    }
  })
};

const EnhancedSettings = withSetTheme(
  loadData({ queries, mutations })(Settings)
);

export default EnhancedSettings;
