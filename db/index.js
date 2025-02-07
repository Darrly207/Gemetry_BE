const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

module.exports = bigquery; 