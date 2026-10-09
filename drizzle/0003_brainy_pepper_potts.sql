ALTER TABLE `sale_items` ADD `costKnown` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `costKnown` boolean DEFAULT true NOT NULL;