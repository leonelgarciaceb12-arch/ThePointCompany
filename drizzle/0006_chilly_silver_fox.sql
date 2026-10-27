CREATE TABLE `backup_schedules` (
	`id` int NOT NULL,
	`taskUid` varchar(160) NOT NULL,
	`name` varchar(180) NOT NULL,
	`cronExpression` varchar(80) NOT NULL,
	`timezone` varchar(80) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
	`enabled` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backup_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `backup_schedules_taskUid_unique` UNIQUE(`taskUid`)
);
--> statement-breakpoint
CREATE TABLE `backup_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`backupDate` date NOT NULL,
	`storageKey` varchar(255) NOT NULL,
	`storageUrl` varchar(255) NOT NULL,
	`checksum` varchar(128) NOT NULL,
	`rowCount` int NOT NULL DEFAULT 0,
	`status` enum('completed','failed') NOT NULL DEFAULT 'completed',
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backup_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `backup_snapshots_backupDate_unique` UNIQUE(`backupDate`)
);
--> statement-breakpoint
CREATE TABLE `editor_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`filePath` varchar(255) NOT NULL,
	`patch` text NOT NULL,
	`status` enum('proposed','approved','rejected','applied') NOT NULL DEFAULT 'proposed',
	`submittedBy` varchar(180) NOT NULL DEFAULT 'Editor restringido',
	`reviewNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `editor_proposals_id` PRIMARY KEY(`id`)
);
