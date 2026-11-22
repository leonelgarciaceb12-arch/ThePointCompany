CREATE TABLE `product_flavors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`stock` int NOT NULL DEFAULT 0,
	`minStock` int NOT NULL DEFAULT 0,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_flavors_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_flavors_product_name_idx` UNIQUE(`productId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `sale_items` ADD `flavorId` int;--> statement-breakpoint
CREATE INDEX `product_flavors_product_idx` ON `product_flavors` (`productId`);