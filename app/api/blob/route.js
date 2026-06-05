import { NextResponse } from "next/server";
import { getPrivateBlob, isBlobStoreEnabled } from "../../../lib/persistent-store";

export async function GET(request) {
  const pathname = request.nextUrl.searchParams.get("pathname");

  if (!pathname) {
    return NextResponse.json(
      {
        ok: false,
        message: "Нужно передать pathname"
      },
      { status: 400 }
    );
  }

  if (!isBlobStoreEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Blob storage не подключён"
      },
      { status: 503 }
    );
  }

  const result = await getPrivateBlob(pathname);

  if (!result || result.statusCode !== 200 || !result.stream) {
    return NextResponse.json(
      {
        ok: false,
        message: "Файл не найден"
      },
      { status: 404 }
    );
  }

  const fileName = pathname.split("/").pop() || "file";

  return new NextResponse(result.stream, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Content-Type": result.blob?.contentType || "application/octet-stream"
    }
  });
}
