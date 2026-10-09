CREATE TABLE `ad_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adDate` date NOT NULL,
	`platform` varchar(80) NOT NULL DEFAULT 'Meta Ads',
	`campaign` varchar(180) NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`conversations` int DEFAULT 0,
	`results` int DEFAULT 0,
	`notes` text,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`phone` varchar(80),
	`locality` varchar(140),
	`notes` text,
	`purchases` int NOT NULL DEFAULT 0,
	`spent` decimal(12,2) NOT NULL DEFAULT '0',
	`profit` decimal(12,2) NOT NULL DEFAULT '0',
	`firstPurchase` date,
	`lastPurchase` date,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseDate` date NOT NULL,
	`category` varchar(120) NOT NULL,
	`description` varchar(255) NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`type` varchar(80) DEFAULT 'Operativo',
	`platform` varchar(80),
	`campaign` varchar(180),
	`notes` text,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('loan','payable_merch','internal') NOT NULL DEFAULT 'loan',
	`counterparty` varchar(180) NOT NULL,
	`description` varchar(255),
	`currency` varchar(12) NOT NULL DEFAULT 'USD',
	`principal` decimal(12,2) NOT NULL DEFAULT '0',
	`paid` decimal(12,2) NOT NULL DEFAULT '0',
	`balance` decimal(12,2) NOT NULL DEFAULT '0',
	`startDate` date,
	`dueDate` date,
	`status` enum('open','partial','paid','overdue') NOT NULL DEFAULT 'open',
	`notes` text,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `objectives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`month` varchar(40) NOT NULL,
	`targetOrders` int NOT NULL DEFAULT 0,
	`targetRevenue` decimal(12,2) NOT NULL DEFAULT '0',
	`targetProfit` decimal(12,2) NOT NULL DEFAULT '0',
	`targetNet` decimal(12,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `objectives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legacyId` int,
	`name` varchar(255) NOT NULL,
	`category` varchar(120) NOT NULL DEFAULT 'Sin categoría',
	`supplier` varchar(160) DEFAULT 'Propio',
	`stock` int NOT NULL DEFAULT 0,
	`cost` decimal(12,2) NOT NULL DEFAULT '0',
	`minStock` int NOT NULL DEFAULT 3,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`productId` int,
	`description` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(12,2) NOT NULL DEFAULT '0',
	`unitCost` decimal(12,2) NOT NULL DEFAULT '0',
	`total` decimal(12,2) NOT NULL DEFAULT '0',
	`costTotal` decimal(12,2) NOT NULL DEFAULT '0',
	`profit` decimal(12,2) NOT NULL DEFAULT '0',
	`fromInventory` boolean NOT NULL DEFAULT false,
	`supplier` varchar(160),
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sale_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legacyId` int,
	`saleDate` date NOT NULL,
	`customerId` int,
	`customerName` varchar(180),
	`customerPhone` varchar(80),
	`channel` varchar(80) DEFAULT 'WhatsApp',
	`total` decimal(12,2) NOT NULL DEFAULT '0',
	`totalCost` decimal(12,2) NOT NULL DEFAULT '0',
	`profit` decimal(12,2) NOT NULL DEFAULT '0',
	`margin` decimal(8,2) NOT NULL DEFAULT '0',
	`status` enum('paid','pending','cancelled') NOT NULL DEFAULT 'paid',
	`notes` text,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`type` enum('purchase','sale','adjustment','return') NOT NULL,
	`quantity` int NOT NULL,
	`unitCost` decimal(12,2) NOT NULL DEFAULT '0',
	`referenceId` int,
	`notes` text,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ad_campaigns_date_idx` ON `ad_campaigns` (`adDate`);--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `customers_last_purchase_idx` ON `customers` (`lastPurchase`);--> statement-breakpoint
CREATE INDEX `expenses_date_idx` ON `expenses` (`expenseDate`);--> statement-breakpoint
CREATE INDEX `loans_due_idx` ON `loans` (`dueDate`);--> statement-breakpoint
CREATE INDEX `loans_status_idx` ON `loans` (`status`);--> statement-breakpoint
CREATE INDEX `products_name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`saleId`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`productId`);--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `sales` (`saleDate`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customerId`);--> statement-breakpoint
CREATE INDEX `stock_movements_product_idx` ON `stock_movements` (`productId`);