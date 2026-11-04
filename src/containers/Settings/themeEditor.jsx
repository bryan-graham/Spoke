import PropTypes from "prop-types";
import React, { useState } from "react";
import { gql } from "@apollo/client";
import * as yup from "yup";
import Form from "react-formal";
import colorDifference from "color-difference";

import withSetTheme from "../hoc/withSetTheme";
import loadData from "../hoc/load-data";
import GSColorPicker from "../../components/forms/GSColorPicker";
import GSForm from "../../components/forms/GSForm";
import GSSubmitButton from "../../components/forms/GSSubmitButton";

import Snackbar from "@material-ui/core/Snackbar";
import Alert from "@material-ui/lab/Alert";

const COLOURS = [
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["info", "Info"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["error", "Error"]
];

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  columnGap: 16
};

const ThemeEditor = props => {
  const palette = props.muiTheme.palette;

  const [saveSuccessful, setSaveSuccessful] = useState(false);
  const [model, setModel] = useState({
    primary: palette.primary.main,
    secondary: palette.secondary.main,
    info: palette.info.main,
    success: palette.success.main,
    warning: palette.warning.main,
    error: palette.error.main
  });

  function isSimilarToBackground(color) {
    try {
      // the scale is 0 to 100;
      // 20 was chosen by what viusally made sense to the developer
      return (
        colorDifference.compare(
          color,
          props.muiTheme.palette.background.default
        ) < 20
      );
    } catch (e) {
      return false;
    }
  }

  const errorMessage =
    "This color will make it hard to see some buttons and text on the background";
  const isValidProps = [
    "is-valid-hex",
    errorMessage,
    val => !isSimilarToBackground(val)
  ];
  const themeFormSchema = yup.object({
    primary: yup
      .string()
      .required()
      .test(...isValidProps),
    secondary: yup
      .string()
      .required()
      .test(...isValidProps),
    info: yup
      .string()
      .required()
      .test(...isValidProps),
    success: yup
      .string()
      .required()
      .test(...isValidProps),
    warning: yup
      .string()
      .required()
      .test(...isValidProps),
    error: yup
      .string()
      .required()
      .test(...isValidProps)
  });

  return (
    <React.Fragment>
      <GSForm
        schema={themeFormSchema}
        onChange={model => setModel(model)}
        value={model}
        onSubmit={data => {
          props.mutations.updateTheme(data).then(() => {
            props.setTheme({
              palette: {
                primary: { main: data.primary },
                secondary: { main: data.secondary },
                info: { main: data.info },
                success: { main: data.success },
                warning: { main: data.warning },
                error: { main: data.error }
              }
            });
            setSaveSuccessful(true);
          });
        }}
      >
        <div style={grid}>
          {COLOURS.map(([name, label]) => (
            <Form.Field
              key={name}
              as={GSColorPicker}
              label={label}
              name={name}
              fullWidth
            />
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Form.Submit
            as={GSSubmitButton}
            label="Save colours"
            disabled={!themeFormSchema.isValidSync(model)}
          />
        </div>
      </GSForm>
      <Snackbar
        open={saveSuccessful}
        autoHideDuration={2000}
        onClose={() => {
          setSaveSuccessful(false);
        }}
      >
        <Alert elevation={6} variant="filled" severity="success">
          Colours saved
        </Alert>
      </Snackbar>
    </React.Fragment>
  );
};

ThemeEditor.propTypes = {
  organizationId: PropTypes.string,
  mutations: PropTypes.object,
  muiTheme: PropTypes.object
};

const mutations = {
  updateTheme: ownProps => ({
    primary,
    secondary,
    info,
    success,
    warning,
    error
  }) => ({
    mutation: gql`
      mutation updateTheme(
        $primary: String
        $secondary: String
        $info: String
        $success: String
        $warning: String
        $error: String
        $organizationId: String!
      ) {
        updateTheme(
          primary: $primary
          secondary: $secondary
          info: $info
          success: $success
          warning: $warning
          error: $error
          organizationId: $organizationId
        ) {
          theme
        }
      }
    `,
    variables: {
      organizationId: ownProps.organizationId,
      primary,
      secondary,
      info,
      success,
      warning,
      error
    }
  })
};

const enhancedThemeEditor = withSetTheme(loadData({ mutations })(ThemeEditor));

export default enhancedThemeEditor;
