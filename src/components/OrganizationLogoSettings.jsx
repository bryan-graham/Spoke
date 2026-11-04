import PropTypes from "prop-types";
import React, { useRef, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import Button from "@material-ui/core/Button";
import Popover from "@material-ui/core/Popover";
import { makeStyles } from "@material-ui/core/styles";
import { IconPhoto } from "@tabler/icons-react";
import useShoreMenu from "./ShoreShell/useShoreMenu";
import { CampaignBrand } from "./ShoreShell/ShoreShell";
import { schemes, v, fonts, layout } from "../styles/shore-tokens";

// The organization's own logos, light and dark, for the sidebar. Only when
// Spoke isn't showing Shore's menu: with Shore, the sidebar shows the logos
// uploaded in Shore, so they're changed there.

export const MAX_BYTES = 512 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export const ORGANIZATION_LOGO_QUERY = gql`
  query getOrganizationLogo($organizationId: String!) {
    organization(id: $organizationId) {
      id
      name
      logo {
        light
        dark
      }
    }
  }
`;

export const UPDATE_ORGANIZATION_LOGO = gql`
  mutation updateOrganizationLogo(
    $organizationId: String!
    $scheme: String!
    $image: String
  ) {
    updateOrganizationLogo(
      organizationId: $organizationId
      scheme: $scheme
      image: $image
    ) {
      id
      logo {
        light
        dark
      }
    }
  }
`;

// What's wrong with a chosen file, or null if it can be uploaded.
export function fileProblem(file) {
  if (!file || !TYPES.includes(file.type)) {
    return "Choose a PNG, JPEG, GIF or WebP image.";
  }
  if (file.size > MAX_BYTES) {
    return "That image is over 512 KB; choose a smaller one.";
  }
  return null;
}

const readAsDataUrl = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const useStyles = makeStyles({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16
  },
  slot: {
    border: `1px solid ${v("panelBorder")}`,
    borderRadius: layout.cardRadius,
    overflow: "hidden"
  },
  // Each preview shows the sidebar's own background for that scheme, so
  // the logo is seen as it will appear.
  preview: {
    height: 104,
    display: "flex",
    alignItems: "center",
    padding: "0 12px",
    borderBottom: `1px solid ${v("panelBorder")}`
  },
  slotFooter: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px"
  },
  slotLabel: {
    flex: 1,
    minWidth: 0,
    fontWeight: 600,
    fontSize: 14,
    color: v("text")
  },
  slotState: { fontWeight: 400, color: v("dimmed"), fontSize: 13 },
  hint: { color: v("dimmed"), fontSize: 13, lineHeight: 1.5, marginTop: 12 },
  error: { color: v("countText"), fontSize: 13, marginTop: 12 },
  shoreNote: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 16,
    borderRadius: layout.cardRadius,
    backgroundColor: v("infoBg"),
    color: v("text"),
    fontSize: 14,
    lineHeight: 1.5
  },
  shoreNoteIcon: { color: v("infoText"), display: "flex", paddingTop: 1 },
  confirm: { padding: 16, maxWidth: 240 },
  confirmTitle: {
    fontFamily: fonts.heading,
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 12
  },
  confirmActions: { display: "flex", justifyContent: "flex-end", gap: 8 }
});

const SCHEME_LABELS = { light: "Light mode", dark: "Dark mode" };

function LogoSlot({
  scheme,
  url,
  fallbackUrl,
  name,
  onUpload,
  onRemove,
  busy
}) {
  const classes = useStyles();
  const input = useRef(null);
  const [confirmAnchor, setConfirmAnchor] = useState(null);
  const shown = url || fallbackUrl;
  const sidebar = schemes[scheme];
  return (
    <div className={classes.slot} data-test={`logo-${scheme}`}>
      <div
        className={classes.preview}
        style={{ backgroundColor: sidebar.canvas, color: sidebar.text }}
      >
        {/* The sidebar's brand, drawn in this scheme's colours. */}
        <div
          style={{
            "--shore-text": sidebar.text,
            width: "100%",
            opacity: url ? 1 : 0.85
          }}
        >
          <CampaignBrand name={name} logoUrl={shown || undefined} />
        </div>
      </div>
      <div className={classes.slotFooter}>
        <div className={classes.slotLabel}>
          {SCHEME_LABELS[scheme]}
          <div className={classes.slotState}>
            {url
              ? "Uploaded"
              : fallbackUrl
              ? `Using the ${scheme === "light" ? "dark" : "light"} logo`
              : "Initials"}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept={TYPES.join(",")}
          style={{ display: "none" }}
          onChange={event => {
            const file = event.target.files && event.target.files[0];
            // let the same file be chosen again after an error
            event.target.value = "";
            if (file) {
              onUpload(file);
            }
          }}
        />
        {url ? (
          <Button
            variant="outlined"
            size="small"
            disabled={busy}
            onClick={event => setConfirmAnchor(event.currentTarget)}
          >
            Remove
          </Button>
        ) : null}
        <Button
          variant="outlined"
          size="small"
          disabled={busy}
          onClick={() => input.current && input.current.click()}
        >
          {url ? "Replace" : "Upload"}
        </Button>
        <Popover
          open={Boolean(confirmAnchor)}
          anchorEl={confirmAnchor}
          onClose={() => setConfirmAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <div className={classes.confirm}>
            <div className={classes.confirmTitle}>Remove this logo?</div>
            <div className={classes.confirmActions}>
              <Button size="small" onClick={() => setConfirmAnchor(null)}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                style={{ backgroundColor: v("countText"), color: "#FFFFFF" }}
                onClick={() => {
                  setConfirmAnchor(null);
                  onRemove();
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        </Popover>
      </div>
    </div>
  );
}

LogoSlot.propTypes = {
  scheme: PropTypes.oneOf(["light", "dark"]).isRequired,
  url: PropTypes.string,
  fallbackUrl: PropTypes.string,
  name: PropTypes.string,
  onUpload: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  busy: PropTypes.bool
};

const shoreSettingsUrl = menu => {
  const items = (menu.groups || []).reduce(
    (all, group) => all.concat(group.items || []),
    []
  );
  const settings = items.find(item => item.key === "settings");
  return settings ? settings.url : null;
};

export default function OrganizationLogoSettings({ organizationId }) {
  const classes = useStyles();
  const { menu: shoreMenu } = useShoreMenu(organizationId);
  const { data } = useQuery(ORGANIZATION_LOGO_QUERY, {
    variables: { organizationId },
    skip: !organizationId
  });
  const [updateLogo] = useMutation(UPDATE_ORGANIZATION_LOGO);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (shoreMenu) {
    const url = shoreSettingsUrl(shoreMenu);
    return (
      <div className={classes.shoreNote} data-test="logo-from-shore">
        <span className={classes.shoreNoteIcon}>
          <IconPhoto size={20} stroke={layout.iconStroke} />
        </span>
        <div>
          The sidebar shows the logos uploaded in Shore, so they match. Change
          them in{" "}
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              Shore&rsquo;s settings
            </a>
          ) : (
            "Shore's settings"
          )}
          .
        </div>
      </div>
    );
  }

  const organization = data && data.organization;
  const logo = (organization && organization.logo) || {};
  const name = (organization && organization.name) || "";

  const save = async (scheme, image) => {
    setBusy(true);
    setError(null);
    try {
      await updateLogo({ variables: { organizationId, scheme, image } });
    } catch (err) {
      setError(
        (err && err.message && err.message.replace(/^GraphQL error: /, "")) ||
          "The logo couldn't be saved. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const upload = scheme => async file => {
    const problem = fileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    await save(scheme, await readAsDataUrl(file));
  };

  return (
    <div>
      <div className={classes.grid}>
        <LogoSlot
          scheme="light"
          url={logo.light}
          fallbackUrl={logo.dark}
          name={name}
          busy={busy}
          onUpload={upload("light")}
          onRemove={() => save("light", null)}
        />
        <LogoSlot
          scheme="dark"
          url={logo.dark}
          fallbackUrl={logo.light}
          name={name}
          busy={busy}
          onUpload={upload("dark")}
          onRemove={() => save("dark", null)}
        />
      </div>
      {error ? (
        <div className={classes.error} role="alert">
          {error}
        </div>
      ) : null}
      <div className={classes.hint}>
        PNG, JPEG, GIF or WebP, up to 512 KB. A square logo sits beside the
        organization&rsquo;s name; a wide wordmark stands alone. With one
        version, it&rsquo;s used in both modes; without either, the sidebar
        shows the organization&rsquo;s initials.
      </div>
    </div>
  );
}

OrganizationLogoSettings.propTypes = {
  organizationId: PropTypes.string
};
