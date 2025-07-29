const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

exports.uploadToS3 = async ({ fileBuffer, fileName, fileType, folder }) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${folder}/${fileName}`,
    Body: fileBuffer,
    ContentType: fileType,
    ACL: 'public-read'
  };

  try {
    const data = await s3.upload(params).promise();
    return data;
  } catch (err) {
    console.error("S3 upload error:", err);
    throw err;
  }
};