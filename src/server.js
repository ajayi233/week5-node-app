import express from "express";
import fileUpload from "express-fileupload";
import morgan from "morgan";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { mkdir } from "fs/promises";
import "dotenv/config";
import { uploadFileToS3, listFilesFromS3, deleteFile } from "./utils/AWSConfig.js";

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
    const limit = 9;
    const offset = (page - 1) * limit;

    const files = await listFilesFromS3();
    // let allImages = [...images, ...files];
    const paginatedImages = files.slice(offset, offset + limit);
    const totalPages = Math.ceil(files.length / limit);

    res.render("index", {
      images: paginatedImages,
      currentPage: page,
      totalPages,
      error: null,
    });
    // res.json({ files });
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

    file.fileName = fileName;
    await uploadFileToS3(file);

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

    await deleteFile(id);
    res.redirect("/");
  } catch (error) {
    console.error("Error deleting image:", error);
    res.redirect("/?error=Failed to delete image");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
