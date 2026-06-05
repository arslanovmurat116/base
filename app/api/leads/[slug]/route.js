import { NextResponse } from "next/server";
import {
  deleteLeadProjectAsset,
  getLeadBySlug,
  updateLeadWorkflow,
  uploadLeadProjectAsset
} from "../../../../lib/server-data";

export async function GET(_request, context) {
  const params = await Promise.resolve(context?.params);
  const slug = params?.slug;
  const lead = await getLeadBySlug(slug);

  if (!lead) {
    return NextResponse.json(
      {
        ok: false,
        message: "Лид не найден"
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: lead
  });
}

export async function PATCH(request, context) {
  const params = await Promise.resolve(context?.params);
  const slug = params?.slug;
  const contentType = request.headers.get("content-type") || "";
  let result;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    result = await uploadLeadProjectAsset(slug, formData);
  } else {
    const body = await request.json();

    if (body?.action === "project-file-delete") {
      result = await deleteLeadProjectAsset(slug, body);
    } else {
      result = await updateLeadWorkflow(slug, body);
    }
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : result.status || 400
  });
}
