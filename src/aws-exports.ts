const awsExports = {
  Auth: {
    Cognito: {
      userPoolId: 'YOUR_COGNITO_USER_POOL_ID',
      userPoolClientId: 'YOUR_COGNITO_APP_CLIENT_ID',
      loginWith: {
        username: true,
        email: true,
      },
    },
  },
};

export default awsExports;
