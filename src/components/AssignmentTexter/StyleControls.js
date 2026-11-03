import { StyleSheet, css } from "aphrodite";
import { v, layout } from "../../styles/shore-tokens";

// The conversation, in Shore's style: the contact's messages on the left in a
// quiet grey bubble, the texter's on the right in the primary navy. Colours
// that depend on the theme (primary) are set in MessageList.
const bubble = {
  width: "fit-content",
  maxWidth: "min(520px, 80%)",
  padding: "8px 14px",
  marginBottom: 10,
  borderRadius: 16,
  fontSize: 15,
  lineHeight: 1.45,
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap"
};

export const messageListStyles = {
  // passesd directly to <MessageList>
  messageList: {
    overflow: "hidden",
    padding: "20px 20px 8px",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    boxSizing: "border-box"
  },
  messageSent: {
    ...bubble,
    textAlign: "left",
    alignSelf: "flex-end",
    marginLeft: "15%",
    borderBottomRightRadius: 4
  },
  messageReceived: {
    ...bubble,
    alignSelf: "flex-start",
    marginRight: "15%",
    borderBottomLeftRadius: 4,
    color: v("text"),
    backgroundColor: v("subtle")
  }
};

export const inlineStyles = {
  inlineBlock: {
    display: "inline-block"
  },
  exitTexterIconButton: {
    float: "left",
    padding: "3px",
    height: "56px",
    zIndex: 100,
    top: 0,
    left: "-12px"
  },
  flatButtonLabel: {
    textTransform: "none",
    fontWeight: 600
  }
};

export const flexStyles = StyleSheet.create({
  topContainer: {
    margin: 0,
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    //messages can be scrolled through and height/width is responsive
    height: "100%",
    backgroundColor: v("panel"),
    color: v("text"),
    "@media(max-width: 420px)": {
      fontFamily: '"Inter Variable", Inter, sans-serif'
    }
  },
  popoverSideboxesInner: {
    // expand to fill the whole popover
    width: "100%",
    height: "100%",
    // show campaign header in-view
    top: "50px",
    left: "18px",
    padding: "20px"
  },
  popover: {
    width: "85%",
    height: "85%",
    "@media(min-height: 800px)": {
      // if it's too tall, the current question options are too far away
      height: "50%"
    }
  },
  popoverLink: {
    float: "right",
    width: "4em",
    marginRight: "2em",
    fontWeight: "normal",
    fontSize: "80%"
  },
  popoverLinkColor: {
    color: v("text")
  },
  sectionHeaderToolbar: {
    flex: "0 0 auto"
  },
  sectionSideBox: {
    flex: "0 1 240px",
    overflowY: "scroll",
    textAlign: "center",
    overflow: "hidden scroll",
    maxWidth: "240px",
    "@media(max-width: 575px)": {
      display: "none"
    }
  },
  sectionSideBoxContent: {
    minHeight: "100%",
    boxSizing: "border-box",
    padding: 20,
    backgroundColor: v("canvas"),
    borderLeft: `1px solid ${v("panelBorder")}`
  },
  superSectionMessageBox: {
    height: "100%",
    "@media(min-height: 300px) and (max-Height: 700px)": {
      height: "100%"
    },
    "@media(min-height: 701px) and (max-Height: 1000px)": {
      height: "53%"
    },
    overflowY: "scroll",
    overflow: "-moz-scrollbars-vertical",
    overflowX: "hidden",
    // for sidebar
    display: "flex",
    flexDirection: "row"
  },
  /// * Section Scrolling Message Thread
  sectionMessageThread: {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    flex: "1 1 auto",
    overflowY: "scroll",
    backgroundColor: v("panel")
  },
  sectionLeftSideBox: {
    flex: "1 0 260px",
    maxWidth: 260,
    overflow: "hidden scroll",
    backgroundColor: v("canvas"),
    borderRight: `1px solid ${v("panelBorder")}`
  },
  superSectionMessagePage: {
    display: "flex",
    flexGrow: 1,
    overflow: "hidden scroll"
  },
  superSectionMessageListAndControls: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    // let it shrink to the window on phones (flex children default to their
    // content's width)
    minWidth: 0,
    maxHeight: "100%"
  },
  /// * Section OptOut Dialog
  sectionOptOutDialog: {
    margin: "12px 16px 16px",
    zIndex: 2000,
    overflow: "visible",
    "@media (hover: hover) and (pointer: fine)": {
      // for touchpads and phones, the edge of the tablet is easier
      // vs for desktops, we want to maximize how far the mouse needs to travel
      maxWidth: "554px"
    }
  },
  optOutDialogContent: {
    paddingTop: 0
  },
  optOutChoices: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  subSectionOptOutDialogActions: {
    marginTop: 16,
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  /// * Section Texting Input Field
  sectionMessageField: {
    // messageField
    flex: "0 0 auto",
    padding: "16px 16px 0",
    borderTop: `1px solid ${v("panelBorder")}`
  },
  subSectionMessageFieldTextField: {
    "@media(max-width: 420px)": {
      overflowY: "scroll !important"
    }
  },
  /// * Section Reply/Exit Buttons
  sectionButtons: {
    flexGrow: "0",
    flexShrink: "0",
    // flexBasis: ${130px|190px}", // stretches and shrinks more quickly than message
    flexDirection: "column",
    display: "flex",
    // flexWrap: "wrap",
    overflow: "hidden",
    position: "relative",
    padding: "0 16px"
  },
  subButtonsAnswerButtons: {
    flex: "1 1 auto", // keeps bottom buttons in place
    // height:105: webkit needs constraint on height sometimes
    //   during the inflection point of showing the shortcut-buttons
    //   without the height, the exit buttons get pushed down oddly
    // internal:
    margin: "10px 0 0",
    width: "100%"
    // similar to 572 below, but give room for other shortcut-buttons
  },
  subSubButtonsAnswerButtonsCurrentQuestion: {
    marginBottom: "8px",
    fontSize: 13,
    color: v("dimmed"),
    //flex: "0 0 auto",
    width: "100%",
    // for mobile:
    whiteSpace: "nowrap",
    overflow: "hidden"
  },
  subSubAnswerButtonsColumns: {
    height: "0px",
    "@media(min-height: 600px)": {
      height: "37px" // TODO
    },
    display: "inline-block",
    //flex: "1 1 50%",
    overflow: "hidden",
    position: "relative"
  },
  subButtonsExitButtons: {
    // all responses on the left, opt out on the right
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    margin: "10px 0 0",
    // to 'win' against absoslute positioned content above it:
    zIndex: "10",
    "@media (hover: hover) and (pointer: fine)": {
      // for touchpads and phones, the edge of the tablet is easier
      // vs for desktops, we want to maximize how far the mouse needs to travel
      maxWidth: "554px"
    }
  },
  /// * Section Send Button
  sectionSend: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "stretch",
    gap: 8,
    padding: "12px 16px 16px",
    "@media (hover: hover) and (pointer: fine)": {
      // for touchpads and phones, the edge of the tablet is easier
      // vs for desktops, we want to maximize how far the mouse needs to travel
      maxWidth: "554px"
    }
  },
  sendButton: {
    flex: "1 1 auto",
    height: 40
  },
  secondaryAction: {
    flex: "0 0 auto",
    minWidth: 96,
    height: 40
  },
  flatButton: {
    height: "40px",
    border: `1px solid ${v("border")}`,
    // FlatButton property, setting here, overrides hover
    // backgroundColor: "white",
    borderRadius: layout.controlRadius,
    boxShadow: "none",
    maxWidth: "300px",
    "@media(max-width: 450px)": {
      // mobile crunch
      minWidth: "auto"
    }
  },
  button: {
    backgroundColor: v("surface"),
    maxWidth: "300px",
    "@media(max-width: 450px)": {
      // mobile crunch
      minWidth: "auto"
    }
  },
  flatButtonLabelMobile: {
    "@media(max-width: 327px)": {
      // mobile crunch
      display: "none"
    }
  }
});
