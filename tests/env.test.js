const ORIGINAL_ENV = { ...process.env };

describe("env config", () => {
  afterEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  test("mengharuskan API secret saat production", () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      API_KEY: "",
      INTERNAL_ADAPTER_TOKEN: ""
    };

    expect(() => require("../src/config/env")).toThrow("API_KEY");
  });

  test("menolak placeholder secret saat production", () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      API_KEY: "change-this-api-key",
      INTERNAL_ADAPTER_TOKEN: "change-this-adapter-token"
    };

    expect(() => require("../src/config/env")).toThrow("API_KEY");
  });
});
