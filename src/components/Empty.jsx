import PropTypes from "prop-types";
import React from "react";
import { StyleSheet, css } from "aphrodite";
import { dataTest } from "../lib/attributes";
import { v, fonts } from "../styles/shore-tokens";

// Shore's empty state (docs/shore-design-guide.md, "Empty state"): a 48px
// round light-ocean icon, a bold one-line title, and a dimmed sentence about
// what will appear or what to do.

const styles = {
  container: {
    margin: "48px auto",
    maxWidth: 420,
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    backgroundColor: v("infoBg"),
    color: v("infoText"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontFamily: fonts.heading,
    fontWeight: 700,
    fontSize: 16,
    color: v("text")
  },
  content: { color: v("dimmed"), fontSize: 14, lineHeight: 1.5 }
};

// hideMobile: hide on phones narrower than 450px (as before).
const mobile = StyleSheet.create({
  hide: { "@media(max-width: 450px)": { display: "none !important" } }
});

const Empty = ({ title, icon, content, hideMobile }) => (
  <div
    style={styles.container}
    className={hideMobile ? css(mobile.hide) : undefined}
    {...dataTest("empty")}
  >
    {icon ? (
      <div style={styles.icon} aria-hidden>
        {React.cloneElement(icon, {
          style: { ...(icon.props.style || {}), width: 24, height: 24 }
        })}
      </div>
    ) : null}
    <div style={styles.title}>{title}</div>
    {content ? <div style={styles.content}>{content}</div> : null}
  </div>
);

Empty.propTypes = {
  title: PropTypes.string,
  icon: PropTypes.object,
  content: PropTypes.node,
  hideMobile: PropTypes.bool
};

export default Empty;
