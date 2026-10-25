BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[ExerciseType] ADD [exerciseOptions] NVARCHAR(1000);

-- AlterTable
ALTER TABLE [dbo].[WorkoutEntry] ADD [durationMinutes] INT,
[exercise] NVARCHAR(100),
[objective] INT,
[repsPerMinute] FLOAT(53);

-- Données : type de séance "EMOM" (10 minutes, Dips / Tractions / Pompes).
-- Passe par EXEC car SQL Server compile le lot d'un bloc : la colonne ajoutée
-- ci-dessus n'y serait pas encore connue.
EXEC(N'
IF NOT EXISTS (SELECT 1 FROM [dbo].[ExerciseType] WHERE [name] = N''EMOM'')
INSERT INTO [dbo].[ExerciseType]
    ([id], [name], [category], [weightLabel], [quickWeights], [weightStep], [timeCapMinutes], [exerciseOptions], [createdAt], [updatedAt])
VALUES
    (LOWER(CONVERT(NVARCHAR(36), NEWID())), N''EMOM'', N''EMOM'', N''Poids du corps'', N''[]'', 5, 10,
     N''["Dips","Tractions","Pompes"]'', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
