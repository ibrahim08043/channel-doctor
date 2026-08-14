import mongoose from "mongoose";

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI must be set. Did you forget to provision a database?",
    );
  }

  if (isConnected) return;

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    mongoose.connection.on("error", (err) => {
      console.error("[db] MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      console.warn("[db] MongoDB disconnected");
    });

    isConnected = true;
    console.log("[db] Connected to MongoDB");
  } catch (error) {
    console.error("[db] MongoDB connection error:", error);
    throw error;
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export { mongoose };
