const cloudinary = require("./cloudinary");

const uploadImage = async (fileBuffer,isPost) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: isPost ? "posts" : "profiles",
        resource_type: "image",
        quality: "auto",
        fetch_format: "auto",
      },
      (error, result) => {
        if (error) return reject(error);

        // ORIGINAL image URL
        const originalUrl = result.secure_url;

        // BLURRED + COMPRESSED version (derived, NOT re-uploaded)
        const blurredUrl = isPost ? cloudinary.url(result.public_id, {
          transformation: [
            { width: 600, crop: "scale" },
            { effect: "blur:300" },
            { quality: "auto:low" },
          ],
          secure: true,
        }) : originalUrl;

        resolve({
          originalUrl,
          blurredUrl,
        });
      }
    ).end(fileBuffer);
  });
};

module.exports = uploadImage;
