import "dotenv/config";
import fs from "fs";
import AWS from "aws-sdk";

const s3 = new AWS.S3({
  accesskeyID: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY_ID,
  region: process.env.AWS_REGION,
});


export const uploadFileToS3 = async (file) => {
  const fileStream = fs.createReadStream(file.tempFilePath);

  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `uploads/${Date.now()}-${file.name}`,
    Body: fileStream,
    // ACL: "public-read",
    ContentType: file.mimetype,
  };

  return s3.upload(uploadParams).promise();
};

export const listFilesFromS3 = async () => {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Prefix: "uploads/", // Only fetch files from the 'uploads/' folder
    };
    const data = await s3.listObjectsV2(params).promise();
    return data.Contents.map((item) => ({
      name: item.Key,
      url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`,
    }));
  };
