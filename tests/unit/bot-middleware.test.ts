import * as notifyStore from "../../src/core/notifyStore";
import { allowedChatIdsMiddleware } from "../../src/core/bot/middleware";

jest.mock("../../src/core/notifyStore");

const mockedNotifyStore = notifyStore as jest.Mocked<typeof notifyStore>;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeCtx(chatId: number): { chat: { id: number }; reply: jest.Mock } {
  return {
    chat: { id: chatId },
    reply: jest.fn(),
  };
}

describe("allowedChatIdsMiddleware", () => {
  it("calls next() when allowedChatIds is empty array (allow all)", async () => {
    mockedNotifyStore.loadAllowedChatIds.mockReturnValue([]);
    const next = jest.fn();
    const ctx = makeCtx(12345);

    await allowedChatIdsMiddleware(ctx as never, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() when chat.id is in allowedChatIds", async () => {
    mockedNotifyStore.loadAllowedChatIds.mockReturnValue(["12345"]);
    const next = jest.fn();
    const ctx = makeCtx(12345);

    await allowedChatIdsMiddleware(ctx as never, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does NOT call next() when chat.id is not in allowedChatIds (silent block)", async () => {
    mockedNotifyStore.loadAllowedChatIds.mockReturnValue(["99999"]);
    const next = jest.fn();
    const ctx = makeCtx(12345);

    await allowedChatIdsMiddleware(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
  });

  it("does NOT call ctx.reply when blocked (silent ignore per D-09)", async () => {
    mockedNotifyStore.loadAllowedChatIds.mockReturnValue(["99999"]);
    const next = jest.fn();
    const ctx = makeCtx(12345);

    await allowedChatIdsMiddleware(ctx as never, next);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
