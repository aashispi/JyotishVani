// app/favicon.tsx — generates favicon dynamically, no image file needed
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size    = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0d0a1a",
          width:       "100%",
          height:      "100%",
          display:     "flex",
          alignItems:  "center",
          justifyContent: "center",
          fontSize:    22,
          color:       "#e8a020",
        }}
      >
        ॐ
      </div>
    ),
    { ...size }
  );
}
