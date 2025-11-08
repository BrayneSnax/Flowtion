CREATE TABLE `artifact_resonance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`targetId` int NOT NULL,
	`score` int NOT NULL,
	`embedDistance` int NOT NULL,
	`sharedTags` text NOT NULL,
	`rhythmSim` int NOT NULL,
	`reason` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifact_resonance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `artifact_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`threadId` int NOT NULL,
	`v` int NOT NULL,
	`kind` enum('image','svg','html','pdf') NOT NULL,
	`uri` text NOT NULL,
	`summary` text NOT NULL,
	`delta` text NOT NULL,
	`createdBy` varchar(64) NOT NULL DEFAULT 'gemini',
	`embedding` text,
	`tags` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifact_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`threadId` int NOT NULL,
	`kind` varchar(64) NOT NULL,
	`payload` text NOT NULL,
	`tags` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`seq` int NOT NULL,
	`text` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`threadId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`text` text NOT NULL,
	`status` enum('streaming','shaping','casting','done','error') NOT NULL DEFAULT 'done',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`activeThreadId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `threads_id` PRIMARY KEY(`id`)
);
