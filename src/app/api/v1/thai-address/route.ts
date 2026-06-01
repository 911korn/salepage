import { NextResponse } from "next/server";
import { getDataForZipCode } from "thai-data";

export const runtime = "nodejs";

// Thai postcode → address is static reference data (ships in the
// `thai-data` package), identical for every caller and effectively
// immutable. Cache hard at the edge so checkout address autocomplete
// stops invoking a function per keystroke-settle.
const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
} as const;

interface ThaiZipData {
  zipCode: string;
  subDistrictList: Array<{
    subDistrictId: string;
    districtId: string;
    provinceId: string;
    subDistrictName: string;
  }>;
  districtList: Array<{
    districtId: string;
    districtName: string;
  }>;
  provinceList: Array<{
    provinceId: string;
    provinceName: string;
  }>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postcode = (searchParams.get("postcode") ?? "")
    .replace(/[^\d]/g, "")
    .slice(0, 5);

  if (postcode.length !== 5) {
    return NextResponse.json(
      {
        ok: true,
        data: { postcode, options: [] },
      },
      { headers: CACHE_HEADERS },
    );
  }

  const data = getDataForZipCode(postcode) as ThaiZipData | null;
  if (!data) {
    return NextResponse.json(
      {
        ok: true,
        data: { postcode, options: [] },
      },
      { headers: CACHE_HEADERS },
    );
  }

  const districts = new Map(
    data.districtList.map((district) => [
      district.districtId,
      district.districtName,
    ]),
  );
  const provinces = new Map(
    data.provinceList.map((province) => [
      province.provinceId,
      province.provinceName,
    ]),
  );
  const seen = new Set<string>();
  const options = data.subDistrictList
    .map((subdistrict) => ({
      key: `${postcode}-${subdistrict.districtId}-${subdistrict.subDistrictId}`,
      postcode,
      subdistrict: subdistrict.subDistrictName,
      district: districts.get(subdistrict.districtId) ?? "",
      province: provinces.get(subdistrict.provinceId) ?? "",
    }))
    .filter((option) => {
      const key = `${option.subdistrict}|${option.district}|${option.province}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) =>
      `${a.province}${a.district}${a.subdistrict}`.localeCompare(
        `${b.province}${b.district}${b.subdistrict}`,
        "th",
      ),
    );

  return NextResponse.json(
    {
      ok: true,
      data: { postcode, options },
    },
    { headers: CACHE_HEADERS },
  );
}
