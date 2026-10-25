BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[ExerciseType] ADD [circuit] NVARCHAR(1000),
[timeCapMinutes] INT;

-- AlterTable
ALTER TABLE [dbo].[WorkoutEntry] ADD [extraReps] INT,
[rounds] INT;

-- Données : le défi Tom Holland, saisi jusqu'ici comme une série de travail
-- "0 kg de leste x N", devient un circuit chronométré de 20 minutes
-- (5 tractions + 10 pompes par tour) et ses séances deviennent "N tours".
-- Les séries d'origine sont conservées. Passe par EXEC car SQL Server compile le
-- lot d'un bloc : les colonnes ajoutées ci-dessus n'y seraient pas encore connues.
EXEC(N'
UPDATE [dbo].[ExerciseType]
SET [category] = N''CIRCUIT'',
    [weightLabel] = N''Poids du corps'',
    [quickWeights] = N''[]'',
    [timeCapMinutes] = 20,
    [circuit] = N''[{"name":"Tractions","reps":5},{"name":"Pompes","reps":10}]'',
    [updatedAt] = CURRENT_TIMESTAMP
WHERE [name] = N''Défi Tom Holland sans squats'' AND [category] = N''BODYWEIGHT_LESTE'';

UPDATE e
SET [rounds] = s.[maxReps], [extraReps] = 0, [templateId] = NULL
FROM [dbo].[WorkoutEntry] e
JOIN [dbo].[ExerciseType] t ON t.[id] = e.[exerciseTypeId]
CROSS APPLY (
    SELECT MAX([reps]) AS [maxReps]
    FROM [dbo].[SetEntry]
    WHERE [workoutEntryId] = e.[id] AND [setType] = N''WORKING''
) s
WHERE t.[category] = N''CIRCUIT'' AND e.[rounds] IS NULL AND s.[maxReps] IS NOT NULL;
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
