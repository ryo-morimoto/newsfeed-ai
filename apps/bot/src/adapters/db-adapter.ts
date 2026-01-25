import { createClient } from "@libsql/client";
import { setDbClientFactory } from "@newsfeed-ai/core/db";

setDbClientFactory(createClient);
