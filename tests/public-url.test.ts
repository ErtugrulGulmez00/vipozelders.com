import { describe, expect, it } from "vitest";
import { publicUrl } from "@/lib/public-url";

describe("yönlendirme adresi", () => {
  it("ters vekil arkasında tarayıcının geldiği adresi kullanır", () => {
    const headers = new Headers({ host: "pikampus.com", "x-forwarded-proto": "https" });
    expect(publicUrl("/koc", { url: "http://localhost:3000/panel-sec", headers }).toString()).toBe("https://pikampus.com/koc");
    expect(publicUrl("/kurum", { url: "http://localhost:3000/", headers: new Headers({ host: "kurum.pikampus.com", "x-forwarded-proto": "https" }) }).host).toBe("kurum.pikampus.com");
    expect(publicUrl("/giris", { url: "http://localhost:3100/x", headers: new Headers({ host: "localhost:3100" }) }).toString()).toBe("http://localhost:3100/giris");
  });
});
