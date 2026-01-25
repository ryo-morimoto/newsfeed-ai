import { createClient } from "@libsql/client/web";
import { setDbClientFactory } from "@newsfeed-ai/core/db";

setDbClientFactory(createClient);
