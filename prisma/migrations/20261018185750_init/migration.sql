BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(36) NOT NULL,
    [username] NVARCHAR(100) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [bodyWeightKg] FLOAT(53),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_username_key] UNIQUE NONCLUSTERED ([username])
);

-- CreateTable
CREATE TABLE [dbo].[ExerciseType] (
    [id] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [category] NVARCHAR(20) NOT NULL,
    [weightLabel] NVARCHAR(1000) NOT NULL,
    [quickWeights] NVARCHAR(1000) NOT NULL CONSTRAINT [ExerciseType_quickWeights_df] DEFAULT '[]',
    [weightStep] FLOAT(53) NOT NULL CONSTRAINT [ExerciseType_weightStep_df] DEFAULT 5,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ExerciseType_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ExerciseType_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ExerciseType_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[WorkoutTemplate] (
    [id] NVARCHAR(36) NOT NULL,
    [exerciseTypeId] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [heavyWeight] FLOAT(53) NOT NULL,
    [mediumWeight] FLOAT(53),
    [lightWeight] FLOAT(53),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkoutTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkoutTemplate_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [WorkoutTemplate_exerciseTypeId_name_key] UNIQUE NONCLUSTERED ([exerciseTypeId],[name])
);

-- CreateTable
CREATE TABLE [dbo].[TemplateBlock] (
    [id] NVARCHAR(36) NOT NULL,
    [templateId] NVARCHAR(36) NOT NULL,
    [order] INT NOT NULL,
    [tier] NVARCHAR(10) NOT NULL,
    [setType] NVARCHAR(10) NOT NULL,
    [count] INT NOT NULL,
    CONSTRAINT [TemplateBlock_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[WorkoutEntry] (
    [id] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [exerciseTypeId] NVARCHAR(36) NOT NULL,
    [templateId] NVARCHAR(36),
    [date] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [WorkoutEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [WorkoutEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SetEntry] (
    [id] NVARCHAR(36) NOT NULL,
    [workoutEntryId] NVARCHAR(36) NOT NULL,
    [order] INT NOT NULL,
    [setType] NVARCHAR(10) NOT NULL,
    [weight] FLOAT(53) NOT NULL,
    [reps] INT NOT NULL,
    CONSTRAINT [SetEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TemplateBlock_templateId_idx] ON [dbo].[TemplateBlock]([templateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkoutEntry_userId_idx] ON [dbo].[WorkoutEntry]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkoutEntry_exerciseTypeId_idx] ON [dbo].[WorkoutEntry]([exerciseTypeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [WorkoutEntry_date_idx] ON [dbo].[WorkoutEntry]([date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SetEntry_workoutEntryId_idx] ON [dbo].[SetEntry]([workoutEntryId]);

-- AddForeignKey
ALTER TABLE [dbo].[WorkoutTemplate] ADD CONSTRAINT [WorkoutTemplate_exerciseTypeId_fkey] FOREIGN KEY ([exerciseTypeId]) REFERENCES [dbo].[ExerciseType]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TemplateBlock] ADD CONSTRAINT [TemplateBlock_templateId_fkey] FOREIGN KEY ([templateId]) REFERENCES [dbo].[WorkoutTemplate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[WorkoutEntry] ADD CONSTRAINT [WorkoutEntry_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[WorkoutEntry] ADD CONSTRAINT [WorkoutEntry_exerciseTypeId_fkey] FOREIGN KEY ([exerciseTypeId]) REFERENCES [dbo].[ExerciseType]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[WorkoutEntry] ADD CONSTRAINT [WorkoutEntry_templateId_fkey] FOREIGN KEY ([templateId]) REFERENCES [dbo].[WorkoutTemplate]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SetEntry] ADD CONSTRAINT [SetEntry_workoutEntryId_fkey] FOREIGN KEY ([workoutEntryId]) REFERENCES [dbo].[WorkoutEntry]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
