const { validationResult } = require("express-validator");
const fs = require("fs");
const path = require("path");

const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  let totalItems;
  try {
    totalItems = await Post.find().countDocuments();
    const post = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);
    res.status(200).json({
      message: "Fetched Posts Successfully!",
      posts: post,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error("Validation Failed! Enter corret details.");
    err.statusCode = 422;
    console.log(err);
    throw err;
  }
  if (!req.file) {
    const err = new Error("No image provided!");
    err.statusCode = 422;
    throw err;
  }
  const title = req.body.title;
  const content = req.body.content;
  const imageUrl = req.file.path.replace("\\", "/");
  let creator;
  try {
    const post = new Post({
      title: title,
      content: content,
      image: imageUrl,
      creator: req.userId,
    });
    await post.save();
    const user = await User.findById(req.userId);
    user.posts.push(post);
    await user.save();
    io.getIO().emit("posts", {
      action: "create",
      post: { ...post._doc, creator: { _id: req.userId, name: user.name } },
    });
    res.status(201).json({
      message: "Post Created Successfully!",
      post: post,
      creator: { _id: user._id, name: user.name },
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      const err = new Error("Post Not Found!");
      err.statusCode = 404;
      throw err;
    }
    res.status(200).json({
      message: "Post fetched",
      post: post,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error("Validation Failed! Enter corret details.");
    err.statusCode = 422;
    throw err;
  }
  const postId = req.params.postId;
  const title = req.body.title;
  const content = req.body.content;
  let image = req.body.image;
  if (req.file) {
    image = req.file.path.replace("\\", "/");
  }
  if (!image) {
    const err = new Error("No File Picked!");
    err.statusCode = 422;
    throw err;
  }
  try {
    const post = await Post.findById(postId).populate("creator");
    if (!post) {
      const err = new Error("Post Not Found!");
      err.statusCode = 404;
      throw err;
    }
    if (post.creator._id.toString() !== req.userId) {
      const err = new Error("Not Authorized");
      err.statusCode = 403;
      throw err;
    }
    if (image !== post.image) {
      clearImage(post.image);
    }
    post.title = title;
    post.image = image;
    post.content = content;
    const result = await post.save();
    io.getIO().emit("posts", {
      action: "update",
      post: result
    });
    res.status(200).json({ message: "Post Updated!", post: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      const err = new Error("Post Not Found!");
      err.statusCode = 404;
      throw err;
    }
    if (post.creator.toString() !== req.userId) {
      const err = new Error("Not Authorized");
      err.statusCode = 403;
      throw err;
    }
    clearImage(post.image);
    await Post.findByIdAndDelete(postId);
    const user = await User.findById(req.userId);
    user.posts.pull(postId);
    await user.save();
    io.getIO().emit("posts", {
      action: "delete",
      post: postId
    });
    res.status(200).json({ message: "Post Deleted!" });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

const clearImage = (filepath) => {
  filepath = path.join(__dirname, "..", filepath);
  fs.unlink(filepath, (err) => console.log(err));
};
