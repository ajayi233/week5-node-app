import express from "express";
import fileUpload from "express-fileupload";
import morgan from "morgan";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";
import fs from "fs";
import { mkdir } from "fs/promises";
import { uploadFileToS3, listFilesFromS3 } from "./utils/aws-config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 3000;

// In-memory storage for images
const images = [];

// Middleware
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true, tempFileDir: "/tmp/" }));
app.use(express.static(join(__dirname, "public")));

// Set view engine
app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

// Routes
app.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const offset = (page - 1) * limit;
    const files = await listFilesFromS3();
    const paginatedImages = files.slice(offset, offset + limit);
    const totalPages = Math.ceil(files.length / limit);
    res.render("index", {
      images: paginatedImages,
      currentPage: page,
      totalPages,
      error: null,
    });
    
  } catch (error) {
    console.error("Error fetching images:", error);
    res.render("index", {
      images: [],
      currentPage: 1,
      totalPages: 1,
      error: "Failed to load images",
    });
  }
});

app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      throw new Error("No image uploaded");
    }

    const file = req.files.image;
    const fileName = `${Date.now()}-${file.name}`;

    // Save file to public directory
    // const filePath = join(__dirname, 'public', 'uploads', fileName);
    // await file.mv(filePath);
    uploadFileToS3(file);

    // Add image to array
    images.push({
      id: Date.now().toString(),
      name: file.name,
      url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.name}`,
    });

    res.redirect("/");
  } catch (error) {
    console.error("Error uploading image:", error);
    res.render("index", {
      images: [],
      currentPage: 1,
      totalPages: 1,
      error: "Failed to upload image",
    });
  }
});

app.post("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const imageIndex = images.findIndex((img) => img.id === id);
    const imageToDelete = images.find((img) => img.id === id);
    if (imageIndex !== -1) {
      // Remove image from array
      images.splice(imageIndex, 1);
      // Delete file from public directory
      // const filePath = join(__dirname, "uploads", images[imageIndex].name);
      fs.unlinkSync(
        join(__dirname, "public", imageToDelete.url),
        (error, data) => {
          if (error) {
            console.log(error);
          } else {
            console.log("image deleted successfully");
          }
        }
      );
    }
    res.redirect("/");
  } catch (error) {
    console.error("Error deleting image:", error);
    res.redirect("/?error=Failed to delete image");
  }
});

// Create uploads directory if it doesn't exist
try {
  await mkdir(join(__dirname, "public", "uploads"), { recursive: true });
} catch (error) {
  if (error.code !== "EEXIST") {
    console.error("Error creating uploads directory:", error);
  }
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
